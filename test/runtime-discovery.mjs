import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createGateway } from '../lib/gateway.js'

const alias = process.env.DSH_TEST_SSH_ALIAS ?? 'jack-dirty-linux'
const source = await readFile(new URL('../lib/bootstrap.sh',import.meta.url),'utf8')
const directoryRoot = new URL('../.verification/',import.meta.url)
await mkdir(directoryRoot,{recursive:true})
const directory = await mkdtemp(new URL('runtime-discovery-',directoryRoot))
assert(process.env.DSH_TEST_HOSTS_FILE,'Set DSH_TEST_HOSTS_FILE to a real local machine record containing the existing service credential')
const prior = JSON.parse(await readFile(process.env.DSH_TEST_HOSTS_FILE,'utf8'))
const records = Array.isArray(prior) ? prior : prior.hosts
const known = records.find(host => host.sshAlias === alias || host.sshAlias === `root@${alias}`)
assert(known?.token,'A real running DSH credential is required for this integration test')
const runProbe = () => new Promise((resolve,reject) => {
  const child = spawn('ssh',['-o','BatchMode=yes',alias,'sh -s -- probe'],{stdio:['pipe','pipe','pipe']})
  let stdout='',stderr=''
  child.stdout.on('data',chunk=>stdout+=chunk)
  child.stderr.on('data',chunk=>stderr+=chunk)
  child.on('error',reject)
  child.on('close',code=>code===0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)))
  child.stdin.end(source)
})
const gateway = createGateway({hostsFile:`${directory}/hosts.json`},{info(){},warn(){}})
try {
  const before = await runProbe()
  assert.equal(before.installDsh,false)
  assert.equal(before.installNode,false)
  assert.equal(before.discovery.runningDsh,true)
  const service = before.discovery.services.find(service=>service.port===known.remotePort)
  assert(service,'The existing service must be discovered')
  assert(!service.executable.includes('/.local/share/dsh-remote-hosts/'))
  console.log('PASS: ordinary noninteractive SSH discovers the real custom DSH installation, Node.js and DSH_HOME without requesting installation')
  await gateway.start()
  const base=`http://127.0.0.1:${gateway.status().gatewayPort}`
  const request = async body => {
    const response=await fetch(`${base}/manage/ssh`,{method:body?'POST':'GET',headers:body&&{'content-type':'application/json'},body:body&&JSON.stringify(body)})
    const result=await response.json()
    assert(response.ok,result.error)
    return result
  }
  const waitFor = async predicate => {
    const deadline=Date.now()+30000
    while(true) {
      const operation=(await request()).operations.at(-1)
      if(predicate(operation)) return operation
      assert(Date.now()<deadline,'Service authentication state timed out')
      await new Promise(resolve=>setTimeout(resolve,150))
    }
  }
  if(!before.discovery.endpoint) {
    await request({action:'connect',alias})
    const waiting=await waitFor(operation=>operation.prompt)
    await request({action:'cancel',id:waiting.id})
    await waitFor(operation=>operation.phase==='cancelled')
    assert.equal(gateway.status().hosts.length,0)
    await request({action:'connect',alias})
    const invalid=await waitFor(operation=>operation.prompt)
    await request({action:'answer',id:invalid.prompt.id,answer:`http://127.0.0.1:${known.remotePort}/?token=invalid-integration-token`})
    const rejected=await waitFor(operation=>operation.phase==='failed')
    assert.match(rejected.error,/认证地址无效或已过期/)
    assert.equal(gateway.status().hosts.length,0)
    console.log('PASS: cancelling URL entry and submitting an invalid real-service credential leave no machine record or forwarding connection')
  }
  let {operation}=await request({action:'connect',alias})
  const deadline=Date.now()+30000
  let answered=false
  while(operation.phase!=='ready') {
    assert(Date.now()<deadline,'Existing-service connection timed out')
    assert(!['failed','cancelled','awaiting-installation','installing','preparing'].includes(operation.phase),operation.error ?? operation.phase)
    if(operation.prompt && !answered) {
      assert.equal(operation.prompt.kind,'dsh-url')
      assert(!JSON.stringify(operation).includes(known.token))
      await request({action:'answer',id:operation.prompt.id,answer:`http://127.0.0.1:${known.remotePort}/?token=${known.token}`})
      answered=true
    }
    await new Promise(resolve=>setTimeout(resolve,150))
    operation=(await request()).operations.at(-1)
  }
  const host=gateway.status().hosts[0]
  assert.equal(host.remotePort,known.remotePort)
  assert.equal(host.auth,'ok')
  const response=await fetch(`${base}/host/${host.id}/api/session/list`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'session/list',payload:{args:{_request:{}}}})})
  const result=await response.json()
  assert.equal(result.result.ok,true)
  const after=await runProbe()
  assert.deepEqual(after.discovery.services.map(service=>service.pid),before.discovery.services.map(service=>service.pid))
  assert(!JSON.stringify(await request()).includes(known.token))
  console.log('PASS: authenticated connection reuses the original remote port and live process, lists real sessions, and keeps credentials out of management responses')
  const again=await request({action:'connect',alias})
  const reconnectDeadline=Date.now()+15000
  while((await request()).operations.find(item=>item.id===again.operation.id).phase!=='ready') {
    assert(Date.now()<reconnectDeadline,'Saved connection failed to reconnect')
    await new Promise(resolve=>setTimeout(resolve,150))
  }
  console.log('PASS: subsequent connections reuse the saved credential without an installation or authentication prompt')
} finally {
  gateway.stop()
  await rm(directory,{recursive:true,force:true})
}

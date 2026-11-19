import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { readFile,writeFile,mkdir,mkdtemp,rm } from 'node:fs/promises'
import { quote } from 'shell-quote'
import { chromium } from 'playwright-core'
import { createGateway } from '../lib/gateway.js'

const root=new URL('../.verification/',import.meta.url)
await mkdir(root,{recursive:true})
const directory=await mkdtemp(new URL('password-',root))
const user=`dshtest${randomBytes(3).toString('hex')}`
const remoteDirectory=`/root/dsh-test/${user}`
const password=randomBytes(24).toString('hex')
const remoteAlias=process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux'
const remotePort=18083
let tunnel,gateway,browser,server
async function ssh(command,input) {
  return new Promise((resolve,reject)=>{
    const child=spawn('ssh',['-o','BatchMode=yes',remoteAlias,command],{stdio:['pipe','pipe','pipe']})
    let stdout='',stderr=''
    child.stdout.on('data',chunk=>stdout+=chunk)
    child.stderr.on('data',chunk=>stderr+=chunk)
    child.on('error',reject)
    child.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr)))
    child.stdin.end(input)
  })
}
async function port() {
  const probe=net.createServer()
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve))
  const value=probe.address().port
  await new Promise(resolve=>probe.close(resolve))
  return value
}
async function waitFor(operation,timeout=20000) {
  const deadline=Date.now()+timeout
  while(!await operation()) {assert(Date.now()<deadline,'operation timed out');await new Promise(resolve=>setTimeout(resolve,100))}
}
try {
  await ssh(quote(['mkdir','-m','700',remoteDirectory]))
  await ssh(quote(['ssh-keygen','-q','-t','ed25519','-N','','-f',`${remoteDirectory}/key`]))
  await ssh(quote(['useradd','-m','-s','/bin/sh',user]))
  await ssh('chpasswd',`${user}:${password}\n`)
  const configuration=`Port ${remotePort}\nListenAddress 127.0.0.1\nHostKey ${remoteDirectory}/key\nPidFile ${remoteDirectory}/sshd.pid\nPasswordAuthentication yes\nPubkeyAuthentication no\nKbdInteractiveAuthentication no\nUsePAM no\nAllowUsers ${user}\nAllowTcpForwarding yes\nPrintMotd no\nLogLevel ERROR\n`
  await ssh(quote(['tee',`${remoteDirectory}/sshd_config`]),configuration)
  await ssh(quote(['/usr/sbin/sshd','-f',`${remoteDirectory}/sshd_config`,'-E',`${remoteDirectory}/sshd.log`]))
  const forwarded=await port()
  tunnel=spawn('ssh',['-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-N','-L',`127.0.0.1:${forwarded}:127.0.0.1:${remotePort}`,remoteAlias],{stdio:'ignore'})
  await waitFor(()=>new Promise(resolve=>{const socket=net.connect(forwarded,'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>{socket.destroy();resolve(false)})}))
  const configFile=`${directory}/config`
  await writeFile(configFile,`Host password-verification\n HostName 127.0.0.1\n User ${user}\n Port ${forwarded}\n UserKnownHostsFile ${directory}/known_hosts\n StrictHostKeyChecking ask\n PubkeyAuthentication no\n ServerAliveInterval 30\n ServerAliveCountMax 2\n`)
  const remoteLog=await readFile(new URL('remote.log',root),'utf8')
  const token=remoteLog.match(/token=([\w-]+)/)[1]
  gateway=createGateway({hostsFile:`${directory}/hosts.json`,sshConfigFile:configFile,hosts:[{id:'password',label:'password-verification',sshAlias:'password-verification',remotePort:18081,localPort:await port(),token}]},{info(){},warn(){}})
  await gateway.start()
  const gatewayPort=gateway.status().gatewayPort
  const module=await readFile(new URL('../client/host-manager.js',import.meta.url),'utf8')
  server=http.createServer((req,res)=>{
    if(req.url==='/host-manager.js'){res.setHeader('content-type','text/javascript');res.end(module);return}
    res.setHeader('content-type','text/html')
    res.end(`<html><body><script type="module">import {openSshManager} from '/host-manager.js';window.manager=openSshManager({gateway:'http://127.0.0.1:${gatewayPort}',mark:'data-dsh-remote-hosts',close:()=>{},connected:()=>{}})</script></body></html>`)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page=await browser.newPage()
  page.setDefaultTimeout(25000)
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('button',{name:'连接',exact:true}).click()
  const challenge=page.locator('[data-dsh-remote-hosts="sshChallenge"]')
  await challenge.waitFor()
  const fingerprint=await ssh(quote(['ssh-keygen','-lf',`${remoteDirectory}/key.pub`]))
  assert((await challenge.innerText()).includes(fingerprint.trim().split(/\s+/)[1]))
  await challenge.locator('input').fill('yes')
  await challenge.getByRole('button',{name:'确定',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-dsh-remote-hosts="sshChallenge"] label').textContent.includes('password'))
  const input=challenge.locator('input')
  assert.equal(await input.getAttribute('type'),'password')
  await input.fill('intentionally-wrong-password')
  const before=await challenge.getAttribute('data-challenge-id')
  await challenge.getByRole('button',{name:'确定',exact:true}).click()
  await page.waitForFunction(id=>document.querySelector('[data-dsh-remote-hosts="sshChallenge"]').dataset.challengeId !== id,before)
  await input.fill(password)
  await challenge.getByRole('button',{name:'确定',exact:true}).click()
  await page.getByRole('status').filter({hasText:'已连接 password-verification'}).waitFor({timeout:45000})
  assert.equal(gateway.status().hosts[0].auth,'ok')
  const response=await fetch(`http://127.0.0.1:${gatewayPort}/host/password/api/session/list`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'session/list',payload:{args:{_request:{}}}})})
  assert.equal((await response.json()).result.ok,true)
  assert(!(await readFile(`${directory}/hosts.json`,'utf8')).includes(password))
  assert.equal(await input.inputValue(),'')
  await page.getByRole('button',{name:'重新连接',exact:true}).click()
  await challenge.waitFor()
  await challenge.getByRole('button',{name:'取消连接',exact:true}).click()
  await page.getByRole('status').filter({hasText:/取消/}).waitFor()
  assert.equal(gateway.status().hosts[0].online,false)
  console.log('PASS: real isolated sshd, host fingerprint, password retry, authenticated DSH forwarding, secret cleanup and cancellation')
} finally {
  await browser?.close()
  gateway?.stop()
  tunnel?.kill('SIGTERM')
  if(server) await new Promise(resolve=>server.close(resolve))
  await ssh(`if test -f ${quote([`${remoteDirectory}/sshd.pid`])}; then kill "$(cat ${quote([`${remoteDirectory}/sshd.pid`])})"; fi`).catch(error=>console.error(error.message))
  await ssh(quote(['userdel','-r',user])).catch(error=>console.error(error.message))
  await ssh(quote(['rm','-rf',remoteDirectory]))
  await rm(directory,{recursive:true,force:true})
}

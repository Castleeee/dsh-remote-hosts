import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { addSshHost, effectiveSshConfig, listSshHosts, parseSshCommand } from '../lib/ssh-config.js'

test('shared OpenSSH config preserves Includes, host options and command additions', async () => {
  const root=new URL('../.verification/',import.meta.url)
  await mkdir(root,{recursive:true})
  const directory=await mkdtemp(new URL('config-',root))
  const file=`${directory}/config`
  const original=`# Existing OpenSSH settings\nInclude ${directory}/included-*\nHost primary secondary\n  HostName 127.0.0.1\n  User root\n  Port 2222\n  ServerAliveInterval 30\n  ServerAliveCountMax 5\n  IdentityFile ~/.ssh/my-key\nHost *\n  ConnectTimeout 7\n`
  try {
    await writeFile(file,original)
    await writeFile(`${directory}/included-1`,'Host nested\n HostName 127.0.0.2\nHost primary\n User included-user\n')
    const hosts=await listSshHosts(file)
    assert.deepEqual(hosts.map(host=>host.alias),['nested','primary','secondary'])
    const effective=await effectiveSshConfig('primary',file)
    assert.equal(effective.serverAliveInterval,30)
    assert.equal(effective.serverAliveCountMax,5)
    assert.equal(effective.port,2222)
    assert.equal(effective.user,'included-user')
    assert.equal(await addSshHost('ssh new-user@new.example -p2209',file),'new.example')
    const saved=await readFile(file,'utf8')
    for(const line of original.trim().split('\n')) assert(saved.includes(line),`preserved line: ${line}`)
    const added=await effectiveSshConfig('new.example',file)
    assert.equal(added.port,2209)
    assert.equal(added.user,'new-user')
    assert.equal(await addSshHost('ssh new-user@new.example -p 2209',file),'new.example')
    assert.equal((await listSshHosts(file)).filter(host=>host.alias==='new.example').length,1)
    assert.equal(parseSshCommand('root@server -p22').config.Port,'22')
    assert.equal(parseSshCommand('ssh -p 2222 root@server').hostname,'server')
    assert.equal(parseSshCommand('ssh root@server -o ServerAliveInterval=30').config.ServerAliveInterval,'30')
    for (const input of ['ssh server echo hi','ssh server; echo hi','ssh -oProxyCommand=touch server','ssh -p0 server','ssh -F /other/config server']) assert.throws(()=>parseSshCommand(input))
  } finally {await rm(directory,{recursive:true,force:true})}
})

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { quote } from 'shell-quote'
import { chromium } from 'playwright-core'
import { createGateway } from '../lib/gateway.js'

const execute = promisify(execFile)
const root = new URL('../.verification/', import.meta.url)
await mkdir(root, { recursive:true })
const directory = await mkdtemp(new URL('installation-', root))
const user = `dshinstall${randomBytes(3).toString('hex')}`
const home = `/home/${user}`
const base = `${home}/.local/share/dsh-remote-hosts`
const remoteDirectory = `/root/dsh-test/${user}`
const sshAlias = process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux'
const remotePort = Number(process.env.DSH_TEST_SSHD_PORT ?? 18084)
let gateway, browser, server, tunnel, userCreated = false
async function ssh(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-p','22','-o','BatchMode=yes',sshAlias,command], { stdio:['pipe','pipe','pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `SSH exited ${code}: ${command}`)))
    child.stdin.end(input)
  })
}
async function port() {
  const probe = net.createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const value = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  return value
}
async function waitFor(operation, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (!await operation()) {
    assert(Date.now() < deadline, 'Operation timed out')
    await new Promise(resolve => setTimeout(resolve, 150))
  }
}
async function serviceDirectories() {
  return (await ssh(`for process in $(pgrep -u ${quote([user])}); do case "$(readlink /proc/$process/exe)" in */bin/node) readlink -e "/proc/$process/cwd";; esac; done`)).trim().split('\n')
}
try {
  await execute('ssh-keygen', ['-q','-t','ed25519','-N','','-f',`${directory}/key`])
  await ssh(quote(['mkdir','-m','700',remoteDirectory]))
  await ssh(quote(['ssh-keygen','-q','-t','ed25519','-N','','-f',`${remoteDirectory}/host-key`]))
  await ssh(quote(['useradd','-m','-s','/bin/sh',user]))
  userCreated = true
  await ssh('chpasswd', `${user}:${randomBytes(32).toString('hex')}\n`)
  await ssh(quote(['install','-d','-m','700','-o',user,'-g',user,`${home}/.ssh`]))
  await ssh(quote(['tee',`${home}/.ssh/authorized_keys`]), await readFile(`${directory}/key.pub`, 'utf8'))
  await ssh(quote(['chown',`${user}:${user}`,`${home}/.ssh/authorized_keys`]))
  const sshd = `Port ${remotePort}\nListenAddress 127.0.0.1\nHostKey ${remoteDirectory}/host-key\nPidFile ${remoteDirectory}/sshd.pid\nPasswordAuthentication no\nPubkeyAuthentication yes\nUsePAM no\nAllowUsers ${user}\nAllowTcpForwarding yes\nPrintMotd no\nLogLevel ERROR\n`
  await ssh(quote(['tee',`${remoteDirectory}/sshd_config`]), sshd)
  await ssh(quote(['/usr/sbin/sshd','-f',`${remoteDirectory}/sshd_config`,'-E',`${remoteDirectory}/sshd.log`]))
  const forwarded = await port()
  tunnel = spawn('ssh', ['-p','22','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-N','-L',`127.0.0.1:${forwarded}:127.0.0.1:${remotePort}`,sshAlias], { stdio:'ignore' })
  await waitFor(() => new Promise(resolve => {
    const socket = net.connect(forwarded, '127.0.0.1')
    socket.once('connect', () => { socket.destroy();resolve(true) })
    socket.once('error', () => { socket.destroy();resolve(false) })
  }))
  const configFile = `${directory}/config`
  await writeFile(configFile, `Host installation-verification\n HostName 127.0.0.1\n User ${user}\n Port ${forwarded}\n IdentityFile ${directory}/key\n IdentitiesOnly yes\n UserKnownHostsFile ${directory}/known_hosts\n StrictHostKeyChecking accept-new\n ServerAliveInterval 30\n`)
  gateway = createGateway({ hostsFile:`${directory}/hosts.json`, sshConfigFile:configFile }, { info(){},warn(){} })
  await gateway.start()
  const gatewayUrl = `http://127.0.0.1:${gateway.status().gatewayPort}`
  const module = await readFile(new URL('../client/host-manager.js', import.meta.url), 'utf8')
  server = http.createServer((req, res) => {
    if (req.url === '/host-manager.js') {res.setHeader('content-type','text/javascript');res.end(module);return}
    res.setHeader('content-type','text/html')
    res.end(`<html><body><script type="module">import {openSshManager} from '/host-manager.js';window.manager=openSshManager({gateway:'${gatewayUrl}',mark:'data-dsh-remote-hosts',close:()=>{window.manager.dispose();window.manager.remove()},connected:()=>{}})</script></body></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true })
  let page = await browser.newPage()
  page.setDefaultTimeout(45000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const pageUrl = `http://127.0.0.1:${server.address().port}`
  await page.goto(pageUrl)
  let confirmation = page.getByRole('group', { name:'安装确认' })
  const connect = () => page.getByRole('button', { name:'连接',exact:true }).click()
  if (process.env.DSH_TEST_EXISTING_NODE) {
    await ssh(quote(['mkdir','-p',base,`${home}/.nvm/versions/node`]))
    await ssh(quote(['cp','-a',process.env.DSH_TEST_EXISTING_APP ?? '/root/dsh-test/app',`${base}/app`]))
    await ssh(quote(['cp','-a',process.env.DSH_TEST_EXISTING_NODE,`${home}/.nvm/versions/node/v24.20.0`]))
    await ssh(quote(['chown','-R',`${user}:${user}`,home]))
    const installed = JSON.parse(await ssh(quote(['cat',`${base}/app/node_modules/@deepseek-ai/dsh/package.json`])))
    assert.equal(installed.version, '0.2.2-rc.1')
    assert.equal((await ssh(quote([`${home}/.nvm/versions/node/v24.20.0/bin/node`,'-p','process.versions.node']))).trim(), '24.20.0')
    await connect()
    await page.getByRole('status').filter({ hasText:'已连接 installation-verification' }).waitFor({ timeout:120000 })
    assert.equal(await confirmation.isVisible(), false)
    const host = gateway.status().hosts[0]
    assert.equal(host.auth, 'ok')
    const serviceDirectory = await serviceDirectories()
    assert(serviceDirectory.every(directory => directory === base), `DSH process directories: ${JSON.stringify(serviceDirectory)}`)
    const response = await fetch(`${gatewayUrl}/host/${host.id}/api/session/list`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'session/list',payload:{args:{_request:{}}}})})
    assert.equal((await response.json()).result.ok, true)
    await ssh(`test ! -e ${quote([`${base}/node`])}`)
    console.log('PASS: preinstalled official DSH and real NVM Node.js start and connect without installation or a confirmation prompt')
    await gateway.removeHost(host.id)
    await ssh(quote(['mv',`${base}/app`,`${base}/app-saved`]))
    await page.getByRole('button', {name:'重新连接',exact:true}).click()
    await confirmation.waitFor()
    assert((await confirmation.innerText()).includes('复用已有 Node.js 24.20.0'))
    assert(!(await confirmation.innerText()).includes('（包含 npm）'))
    await confirmation.getByRole('button', {name:'拒绝并断开'}).click()
    await page.getByRole('status').filter({hasText:'已拒绝安装，未连接'}).waitFor()
    await ssh(`test ! -e ${quote([`${base}/app`])} && test ! -e ${quote([`${base}/node`])}`)
    assert.equal(gateway.status().hosts.length, 0)
    console.log('PASS: missing DSH with preinstalled Node.js prompts only for DSH; refusal leaves both installation and forwarding absent')
    await connect()
    await confirmation.waitFor()
    await confirmation.getByRole('button', {name:'安装并连接'}).click()
    await page.getByRole('button', {name:'安装中…',exact:true}).waitFor()
    await waitFor(async () => /\bnpm\b/.test(await ssh(`${quote(['ps','-u',user,'-o','comm='])} || test "$?" = 1`)))
    await page.getByRole('button', {name:'关闭机器管理'}).click()
    await page.close()
    page = await browser.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(pageUrl)
    await page.getByRole('button', {name:'安装中…',exact:true}).waitFor()
    await page.getByRole('button', {name:'取消 installation-verification 的安装'}).click()
    await page.getByRole('status').filter({hasText:'安装已取消'}).waitFor()
    await waitFor(async () => !/\bnpm\b/.test(await ssh(`${quote(['ps','-u',user,'-o','comm='])} || test "$?" = 1`)))
    await ssh(`test ! -e ${quote([`${base}/app`])} && test -z "$(find ${quote([base])} -maxdepth 1 -name 'install-*' -print)"`)
    assert.equal((await ssh(quote([`${home}/.nvm/versions/node/v24.20.0/bin/node`,'-p','process.versions.node']))).trim(), '24.20.0')
    assert.equal(gateway.status().hosts.length, 0)
    console.log('PASS: actual npm installation continues after manager and browser page close, restores progress on reopen, and cancels with remote process and staging cleanup while preserving installed Node.js')
  } else {
  await connect()
  await confirmation.waitFor()
  const details = await confirmation.innerText()
  assert(details.includes('DSH 0.2.2-rc.1'))
  assert(details.includes('Node.js 24.20.0'))
  assert(details.includes('通过 SSH 命令'))
  await ssh(`test ! -e ${quote([base])}`)
  assert.equal(gateway.status().hosts.length, 0)
  const [operation] = (await (await fetch(`${gatewayUrl}/manage/ssh`)).json()).operations
  const stale = await fetch(`${gatewayUrl}/manage/ssh`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm-installation',id:operation.id,confirmationId:'expired',accepted:true}) })
  assert.equal(stale.status, 400)
  await confirmation.getByRole('button', { name:'拒绝并断开' }).click()
  await page.getByRole('status').filter({ hasText:'已拒绝安装，未连接' }).waitFor()
  await ssh(`test ! -e ${quote([base])}`)
  assert.equal(gateway.status().hosts.length, 0)
  console.log('PASS: real SSH inspection makes no installation changes; refusal and stale confirmation cannot install or connect')

  await connect()
  await confirmation.waitFor()
  await page.getByRole('button', { name:'关闭机器管理' }).click()
  await waitFor(async () => (await (await fetch(`${gatewayUrl}/manage/ssh`)).json()).operations.at(-1).phase === 'cancelled')
  await ssh(`test ! -e ${quote([base])}`)
  assert.equal(gateway.status().hosts.length, 0)
  console.log('PASS: closing installation confirmation cancels the connection without installing')

  await page.goto(pageUrl)
  await connect()
  await confirmation.waitFor()
  await confirmation.getByRole('button', { name:'安装并连接' }).click()
  let installing = page.getByRole('button', {name:'安装中…',exact:true})
  await installing.waitFor()
  assert.equal(await installing.isDisabled(), true)
  const processes = () => ssh(`${quote(['ps','-u',user,'-o','comm='])} || test "$?" = 1`)
  await waitFor(async () => /\bcurl\b|\bnpm\b/.test(await processes()))
  console.log('PASS: real remote download is running while the machine row displays installation progress')
  await page.getByRole('button', {name:'关闭机器管理'}).click()
  assert.equal(await page.getByRole('dialog').count(), 0)
  let operations = (await (await fetch(`${gatewayUrl}/manage/ssh`)).json()).operations
  assert.equal(operations.at(-1).phase, 'installing')
  await page.goto(pageUrl)
  await installing.waitFor()
  await page.getByRole('button', {name:'取消 installation-verification 的安装'}).click()
  await page.getByRole('status').filter({hasText:'安装已取消'}).waitFor()
  await waitFor(async () => !/\bcurl\b|\bnpm\b/.test(await processes()))
  await ssh(`test ! -e ${quote([`${base}/app`])} && test -z "$(find ${quote([base])} -maxdepth 1 -name 'install-*' -print)"`)
  assert.equal(gateway.status().hosts.length, 0)
  console.log('PASS: real installation uses installation label and cancel button; closing and reopening preserves progress; cancellation stops actual remote downloads and removes staging without connecting')

  await connect()
  await confirmation.waitFor()
  await confirmation.getByRole('button', { name:'安装并连接' }).click()
  await page.getByRole('button', {name:'关闭机器管理'}).click()
  await page.close()
  page = await browser.newPage()
  page.setDefaultTimeout(45000)
  page.on('pageerror', error => errors.push(error.message))
  confirmation = page.getByRole('group', {name:'安装确认'})
  installing = page.getByRole('button', {name:'安装中…',exact:true})
  await page.goto(pageUrl)
  await installing.waitFor()
  await waitFor(async () => {
    const operation = (await (await fetch(`${gatewayUrl}/manage/ssh`)).json()).operations.at(-1)
    assert(!['failed','cancelled'].includes(operation.phase), operation.error)
    return operation.phase === 'ready'
  },600000)
  await page.getByRole('status').filter({ hasText:'已连接 installation-verification' }).waitFor()
  const host = gateway.status().hosts[0]
  assert.equal(host.auth, 'ok')
  const nodeVersion = (await ssh(quote([`${base}/node/bin/node`,'-p','process.versions.node']))).trim()
  assert.equal(nodeVersion, '24.20.0')
  const installed = JSON.parse(await ssh(quote(['cat',`${base}/app/node_modules/@deepseek-ai/dsh/package.json`])))
  assert.equal(installed.version, '0.2.2-rc.1')
  const directories = await serviceDirectories()
  assert(directories.every(directory => directory === base), `DSH process directories: ${JSON.stringify(directories)}`)
  const response = await fetch(`${gatewayUrl}/host/${host.id}/api/session/list`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'session/list',payload:{args:{_request:{}}}}) })
  assert.equal((await response.json()).result.ok, true)
  console.log('PASS: immediate close after approval preserves installation; background Node.js 24.20.0 and official DSH 0.2.2-rc.1 installation completes and authenticates over SSH after reopening')

  await gateway.removeHost(host.id)
  await ssh(quote(['mkdir','-p',`${home}/.nvm/versions/node`]))
  await ssh(quote(['mv',`${base}/node`,`${home}/.nvm/versions/node/v24.20.0`]))
  await ssh(quote(['mv',`${base}/app`,`${base}/app-saved`]))
  await page.getByRole('button', { name:'重新连接',exact:true }).click()
  await confirmation.waitFor()
  const reuse = await confirmation.innerText()
  assert(reuse.includes('复用已有 Node.js 24.20.0'))
  assert(!reuse.includes('（包含 npm）'))
  await confirmation.getByRole('button', { name:'拒绝并断开' }).click()
  await page.getByRole('status').filter({ hasText:'已拒绝安装，未连接' }).waitFor()
  await ssh(`test ! -e ${quote([`${base}/app`])} && test ! -e ${quote([`${base}/node`])}`)
  await connect()
  await confirmation.waitFor()
  await confirmation.getByRole('button', {name:'安装并连接'}).click()
  await installing.waitFor()
  await waitFor(async () => /\bnpm\b/.test(await processes()))
  await page.getByRole('button', {name:'取消 installation-verification 的安装'}).click()
  await page.getByRole('status').filter({hasText:'安装已取消'}).waitFor()
  await waitFor(async () => !/\bnpm\b/.test(await processes()))
  await ssh(`test ! -e ${quote([`${base}/app`])} && test -z "$(find ${quote([base])} -maxdepth 1 -name 'install-*' -print)"`)
  assert.equal(gateway.status().hosts.length, 0)
  console.log('PASS: cancellation during actual npm installation stops the remote installer and cleans incomplete packages; existing Node.js and DSH service are preserved')
  await ssh(quote(['mv',`${base}/app-saved`,`${base}/app`]))
  console.log('PASS: existing compatible NVM Node.js is reused and omitted from the installation plan')
  await connect()
  await page.getByRole('status').filter({ hasText:'已连接 installation-verification' }).waitFor({ timeout:120000 })
  assert.equal(await confirmation.isVisible(), false)
  await ssh(`test ! -e ${quote([`${base}/node`])}`)
  assert.equal(gateway.status().hosts[0].auth, 'ok')
  console.log('PASS: existing DSH and compatible NVM Node.js connect without an installation prompt or runtime download')
  }
  assert.deepEqual(errors, [])
} finally {
  await browser?.close()
  gateway?.stop()
  tunnel?.kill('SIGTERM')
  if (server) await new Promise(resolve => server.close(resolve))
  if (userCreated) {
    await ssh(quote(['pkill','-KILL','-u',user])).catch(() => {})
    await waitFor(async () => (await ssh(`ps -u ${quote([user])} -o pid= | wc -l`)).trim() === '0')
    await ssh(quote(['userdel','-r',user]))
  }
  await ssh(`if test -f ${quote([`${remoteDirectory}/sshd.pid`])}; then kill "$(cat ${quote([`${remoteDirectory}/sshd.pid`])})"; fi`).catch(error => console.error(error.message))
  await ssh(quote(['rm','-rf',remoteDirectory]))
  await rm(directory, { recursive:true,force:true })
}

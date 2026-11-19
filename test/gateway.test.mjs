import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createGateway } from '../lib/gateway.js'

const verification = new URL('../.verification/', import.meta.url)
await mkdir(verification, { recursive: true })

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function freePort() {
  const server = net.createServer()
  const port = await listen(server)
  await new Promise(resolve => server.close(resolve))
  return port
}

async function fixture(t, config = {}) {
  const directory = await mkdtemp(new URL('gateway-', verification))
  const gatewayPort = await freePort()
  const gateway = createGateway({ gatewayPort, hostsFile: path.join(directory, 'hosts.json'), ...config })
  t.after(async () => { gateway.stop(); await rm(directory, { recursive: true, force: true }) })
  await gateway.start()
  return { gateway, base: `http://127.0.0.1:${gatewayPort}`, gatewayPort }
}

test('gateway applies Origin checks to real HTTP and WebSocket connections', async t => {
  const { base } = await fixture(t)
  for (const origin of [undefined, 'dsh-app://app', 'http://127.0.0.1:43140', 'http://localhost:43140']) {
    const response = await fetch(`${base}/status`, { headers: origin === undefined ? {} : { Origin: origin } })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).running, true)
    if (origin !== undefined) assert.equal(response.headers.get('access-control-allow-origin'), origin)
  }
  for (const origin of ['null', 'https://untrusted.example', 'http://127.0.0.1.untrusted.example']) {
    const response = await fetch(`${base}/manage/hosts`, { headers: { Origin: origin } })
    assert.equal(response.status, 403)
  }
  const target = new URL(base)
  const socket = net.connect(Number(target.port), target.hostname)
  const response = await new Promise((resolve, reject) => {
    socket.on('error', reject)
    socket.on('data', bytes => resolve(bytes.toString()))
    socket.on('connect', () => socket.write('GET /host/jack/api/remote.mux HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nOrigin: https://untrusted.example\r\n\r\n'))
  })
  socket.destroy()
  assert.match(response, /403 Forbidden/)
})

test('independent gateways allocate distinct ports and release both listeners', async t => {
  const directory = await mkdtemp(new URL('gateway-ports-', verification))
  const gateways = ['one', 'two'].map(name => createGateway({ hostsFile: path.join(directory, name, 'hosts.json') }, { info() {}, warn() {} }))
  t.after(async () => { for (const gateway of gateways) gateway.stop(); await rm(directory, { recursive: true, force: true }) })
  await Promise.all(gateways.map(gateway => gateway.start()))
  const ports = gateways.map(gateway => gateway.status().gatewayPort)
  assert.equal(new Set(ports).size, 2)
  for (const port of ports) assert.equal((await (await fetch(`http://127.0.0.1:${port}/status`)).json()).gatewayPort, port)
  for (const gateway of gateways) gateway.stop()
  for (const port of ports) await assert.rejects(fetch(`http://127.0.0.1:${port}/status`))
})

test('machine edits reject invalid identity, SSH option and port values', async t => {
  const { base, gatewayPort } = await fixture(t)
  const host = { id: 'jack', sshAlias: 'root@jack-dirty-linux', localPort: 18091, remotePort: 18081 }
  for (const change of [{ id: 'jack:other' }, { sshAlias: '-Fconfig' }, { sshAlias: 'root@host\nother' }, { localPort: 1.5 }, { remotePort: 65536 }, { localPort: gatewayPort }]) {
    const response = await fetch(`${base}/manage/hosts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upsert', host: { ...host, ...change } }) })
    assert.equal(response.status, 400, JSON.stringify(change))
    assert.equal((await response.json()).ok, false)
  }
  assert.deepEqual((await (await fetch(`${base}/manage/hosts`)).json()).hosts, [])
})

test('occupied ports stay offline and their listener survives removal and shutdown', async t => {
  const listener = net.createServer(socket => socket.once('data', () => socket.end('occupied')))
  const localPort = await listen(listener)
  t.after(() => new Promise(resolve => listener.close(resolve)))
  const host = { id: 'jack', label: 'config label', sshAlias: 'root@jack-dirty-linux', localPort, remotePort: 18081, token: 'not-used-on-conflicted-port' }
  const { gateway, base } = await fixture(t, { hosts: [host] })
  assert.equal(gateway.status().hosts[0].online, false)
  assert.match(gateway.status().hosts[0].error, /occupied/)
  assert.equal((await fetch(`${base}/host/jack/api/session/list`)).status, 503)
  await gateway.upsertHost({ ...host, label: 'edited label', token: '' })
  const saved = JSON.parse(await readFile(gateway.status().hostsFile, 'utf8'))
  assert.equal(saved.hosts[0].label, 'edited label')
  assert.equal(saved.hosts[0].token, host.token)
  assert.equal((await stat(gateway.status().hostsFile)).mode & 0o777, 0o600)
  assert.equal(JSON.stringify(await (await fetch(`${base}/manage/hosts`)).json()).includes(host.token), false)
  gateway.stop()
  const restarted = createGateway({ gatewayPort: await freePort(), hostsFile: gateway.status().hostsFile, hosts: [host] })
  t.after(() => restarted.stop())
  await restarted.start()
  assert.equal(restarted.status().hosts[0].label, 'edited label')
  await restarted.removeHost('jack')
  assert.deepEqual(restarted.status().hosts, [])
  restarted.stop()
  assert.equal(listener.listening, true)
  const socket = net.connect(localPort, '127.0.0.1')
  socket.on('connect', () => socket.write('probe'))
  const bytes = await new Promise((resolve, reject) => { socket.on('data', resolve); socket.on('error', reject) })
  assert.equal(bytes.toString(), 'occupied')
  socket.destroy()
})

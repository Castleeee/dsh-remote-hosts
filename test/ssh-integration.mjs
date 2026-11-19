import assert from 'node:assert/strict'
import net from 'node:net'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createGateway } from '../lib/gateway.js'

const token = process.env.DSH_TEST_REMOTE_TOKEN
assert(token, 'Set DSH_TEST_REMOTE_TOKEN to the real remote DSH token')
const verification = new URL('../.verification/', import.meta.url)
await mkdir(verification, { recursive: true })
const directory = await mkdtemp(new URL('ssh-', verification))

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function isOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
  })
}

async function closed(port) {
  const deadline = Date.now() + 5000
  while (await isOpen(port)) {
    assert(Date.now() < deadline, `port ${port} was not released`)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

const host = {
  id: 'ssh-integration', label: 'SSH integration',
  sshAlias: process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux',
  remotePort: Number(process.env.DSH_TEST_REMOTE_PORT ?? 18082),
  localPort: await freePort(), token,
}
const gatewayPort = await freePort()
const gateway = createGateway({ gatewayPort, hostsFile: `${directory}/hosts.json`, hosts: [host] })
const base = `http://127.0.0.1:${gatewayPort}`

async function list() {
  return fetch(`${base}/host/${host.id}/api/session/list`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'session/list', payload: { args: { _request: {} } } }),
  })
}

try {
  await gateway.start()
  assert.equal(gateway.status().hosts[0].online, true)
  assert.equal(gateway.status().hosts[0].auth, 'ok')
  assert.equal((await (await list()).json()).result.ok, true)
  console.log('real SSH tunnel and authenticated HTTP passed')

  await gateway.upsertHost({ ...host, label: 'edited', token: '' })
  assert.equal(gateway.status().hosts[0].label, 'edited')
  assert.equal(gateway.status().hosts[0].auth, 'ok')
  console.log('SSH replacement and retained token passed')

  await gateway.upsertHost({ ...host, token: 'invalid-test-token' })
  assert.equal(gateway.status().hosts[0].auth, 'failed')
  assert.equal((await list()).status, 502)
  await gateway.upsertHost(host)
  assert.equal(gateway.status().hosts[0].auth, 'ok')
  assert.equal((await (await list()).json()).result.ok, true)
  console.log('real authentication failure and token recovery passed')

  await gateway.removeHost(host.id)
  await closed(host.localPort)
  assert.deepEqual(gateway.status().hosts, [])
  await gateway.upsertHost(host)
  assert.equal(gateway.status().hosts[0].online, true)
  gateway.stop()
  await closed(host.localPort)
  await closed(gatewayPort)
  console.log('PASS: SSH alias, authentication, editing, removal and shutdown')
} finally {
  gateway.stop()
  await rm(directory, { recursive: true, force: true })
}

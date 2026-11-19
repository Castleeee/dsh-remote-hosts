import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import { openLab } from './support/browser.mjs'

const labUrl = process.env.DSH_LAB_URL
const tunnelPid = Number(process.env.DSH_TEST_TUNNEL_PID)
assert(labUrl, 'Set DSH_LAB_URL to the authenticated lab URL')
assert(Number.isInteger(tunnelPid) && tunnelPid > 1, 'Set DSH_TEST_TUNNEL_PID to this gateway-owned SSH forwarding process')
const gateway = process.env.DSH_GATEWAY_URL ?? 'http://127.0.0.1:43130'
const host = process.env.DSH_TEST_HOST ?? 'jack'
async function api(method, args) {
  const response = await fetch(`${gateway}/host/${encodeURIComponent(host)}/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
  })
  assert.equal(response.status, 200)
  const result = (await response.json()).result
  assert.equal(result.ok, true, JSON.stringify(result.error))
  return result.value
}
const { workspace } = await api('workspace/create', { request: { path: '/root/dsh-test' } })
const { sessionId } = await api('session/create', { request: { workspaceId: workspace.workspaceId } })
const id = `remote:${host}:${sessionId}`
const { browser, page, errors, sockets } = await openLab(labUrl)
try {
  await api('session/rename', { request: { sessionId, title: 'Remote reconnect before' } })
  console.log('reconnect session created',id)
  await page.waitForFunction(id => window.verificationCtx.sessions.list.getSnapshot().byId[id], id)
  await page.evaluate(async ({ id, history }) => {
    const ctx = window.verificationCtx
    window.reconnectReferences = [id, history].filter(Boolean).map(id => ctx.sessions.retain(id, { source: 'reconnect-acceptance' }))
    await Promise.all(window.reconnectReferences.map(reference => reference.ready))
    window.reconnectBindings = window.reconnectReferences.map(reference => reference.binding)
    window.reconnectSeqs = window.reconnectBindings.map(binding => binding.eventSource.getSnapshot().entries.map(entry => entry.event.seq))
    await ctx.uiWorkspace.openSession(id)
  }, { id, history: process.env.DSH_HISTORY_SESSION ? `remote:${host}:${process.env.DSH_HISTORY_SESSION}` : undefined })
  console.log('reconnect sessions retained')
  const onboarding=page.getByRole('dialog').filter({hasText:'开始使用'})
  if(await onboarding.count()) await onboarding.getByRole('button',{name:'关闭',exact:true}).click()
  const hostRow=page.locator(`[data-dsh-remote-row="host"][data-host-id="${host}"]`)
  if(await hostRow.getAttribute('aria-expanded')==='false') await hostRow.click()
  const workspaceRow=page.locator(`[data-dsh-remote-row="workspace"][data-host-id="${host}"]`).first()
  if(await workspaceRow.getAttribute('aria-expanded')==='false') await workspaceRow.click()
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, id)
  const connections = sockets.filter(socket => socket.url().startsWith(`${gateway.replace(/^http/, 'ws')}/host/${host}/`))
  assert(connections.length >= 2, 'The real remote event and data sockets must be open')
  const disconnected = Promise.all(connections.map(socket => new Promise(resolve => socket.on('close', resolve))))
  process.kill(tunnelPid, 'SIGTERM')
  await Promise.race([disconnected, setTimeout(15000).then(() => { throw new Error('Remote sockets stayed open after SSH interruption') })])
  console.log('PASS: remote sockets close after the owned SSH tunnel terminates')
  const deadline = Date.now() + 45000
  while (true) {
    const status = await (await fetch(`${gateway}/status`)).json()
    if (status.hosts.some(item => item.id === host && item.online && item.auth === 'ok')) break
    assert(Date.now() < deadline, 'The gateway did not restore its SSH tunnel')
    await setTimeout(250)
  }
  await api('session/rename', { request: { sessionId, title: 'Remote reconnect after' } })
  await page.waitForFunction(() => window.reconnectBindings[0].session.projections.get('title') === 'Remote reconnect after', undefined, { timeout: 45000 })
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, id)
  const result = await page.evaluate(async () => {
    const ctx = window.verificationCtx
    const checks = []
    for (let index = 0; index < window.reconnectBindings.length; index++) {
      const binding = window.reconnectBindings[index]
      await binding.session.open()
      const entries = binding.eventSource.getSnapshot().entries
      const seqs = entries.filter(entry => entry.type === 'event').map(entry => entry.event.seq)
      checks.push({
        sameBinding: ctx.sessions.binding(binding.sessionId) === binding,
        unique: new Set(seqs).size === seqs.length,
        preserved: window.reconnectSeqs[index].every(seq => seqs.includes(seq)),
        count: seqs.length,
        state: binding.session.getSnapshot().openState,
      })
    }
    return checks
  })
  console.log('reconnected sessions', JSON.stringify(result))
  for (const check of result) {
    assert.equal(check.sameBinding, true)
    assert.equal(check.unique, true)
    assert.equal(check.preserved, true)
    assert.equal(check.state, 'open')
  }
  const command = await page.evaluate(() => window.reconnectBindings[0].ctx.remote.commands.list())
  assert.equal(command.ok, true)
  assert(command.value.length > 0)
  assert.deepEqual(errors, [])
  console.log('PASS: SSH reconnect restores projections, history and scoped RPC without replacing retained bindings')
} finally {
  try { await api('workspace/archiveSession', { request: { sessionId } }) }
  finally { await browser.close() }
}

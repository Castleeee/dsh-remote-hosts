import assert from 'node:assert/strict'
import { openLab } from './support/browser.mjs'

const labUrl = process.env.DSH_LAB_URL
assert(labUrl, 'Set DSH_LAB_URL to the authenticated lab URL')
const gateway = process.env.DSH_GATEWAY_URL ?? 'http://127.0.0.1:43130'
const host = process.env.DSH_TEST_HOST ?? 'jack'

async function api(method, args) {
  const response = await fetch(`${gateway}/host/${encodeURIComponent(host)}/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
  })
  const result = (await response.json()).result
  assert.equal(result.ok, true, JSON.stringify(result.error))
  return result.value
}
const { workspace } = await api('workspace/create', { request: { path: '/root/dsh-test' } })
const { sessionId } = await api('session/create', { request: { workspaceId: workspace.workspaceId } })
const id = `remote:${host}:${sessionId}`
const { browser, page, errors } = await openLab(labUrl)
const outcomes = []
page.on('request', request => { if (request.url().endsWith('/api/$events/result')) outcomes.push(request.postDataJSON().payload.args.outcome) })
try {
  await page.waitForFunction(id => window.verificationCtx.sessions.list.getSnapshot().byId[id], id)
  await page.evaluate(async id => {
    const ctx = window.verificationCtx
    window.cancelReference = ctx.sessions.retain(id, { source: 'question-cancel-acceptance' })
    await window.cancelReference.ready
    window.cancelSession = window.cancelReference.binding.session
    await window.cancelSession.rename('Remote question cancel acceptance')
    await ctx.uiWorkspace.openSession(id)
    const prompt = await window.cancelSession.prompt([{ type: 'text', text: '只调用一次 ask_user_question，询问“取消验收”，提供继续和结束两个选项，等待我的操作。如果取消，不要重试，不要调用其他工具，只回复 DSH_CANCEL_HANDLED。' }], 'queue')
    if (!prompt.ok) throw new Error(prompt.error.message)
  }, id)
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, id)
  await page.getByRole('button', { name: '放弃整组问题', exact: true }).waitFor({ timeout: 90000 })
  await page.getByRole('button', { name: '放弃整组问题', exact: true }).click()
  await page.waitForFunction(() => window.cancelSession.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'turn/end'), undefined, { timeout: 90000 })
  assert(outcomes.some(outcome => outcome.kind === 'rejected' && outcome.error.code === 'ASK_CANCELLED'), JSON.stringify(outcomes))
  const result = await page.evaluate(() => ({ snapshot: window.cancelSession.getSnapshot(), results: window.cancelSession.eventSource.getSnapshot().entries.filter(entry => entry.event.type === 'tool/result' || entry.event.type === 'turn/end') }))
  console.log('question cancellation', JSON.stringify({ outcomes, result }))
  assert.equal(result.snapshot.lastAgentError, null)
  assert(result.results.some(entry => entry.event.type === 'tool/result' && JSON.stringify(entry.event.data).includes('cancelled')))
  assert.deepEqual(errors, [])
  console.log('PASS: native question cancellation preserves ASK_CANCELLED on the remote host')
} finally {
  if (await page.evaluate(() => window.cancelSession?.getSnapshot().running)) await page.evaluate(() => window.cancelSession.cancel())
  try { await api('workspace/archiveSession', { request: { sessionId } }) }
  finally { await browser.close() }
}

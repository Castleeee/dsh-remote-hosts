import assert from 'node:assert/strict'
import { openLab } from './support/browser.mjs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const labUrl = process.env.DSH_LAB_URL
assert(labUrl, 'Set DSH_LAB_URL to the authenticated lab URL')
const gateway = process.env.DSH_GATEWAY_URL ?? 'http://127.0.0.1:43130'
const host = process.env.DSH_TEST_HOST ?? 'jack'
const sshAlias = process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux'
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
const { browser, page, errors } = await openLab(labUrl)
const entries = () => page.evaluate(() => window.liveSession.eventSource.getSnapshot().entries.map(({ type, event }) => ({ type, event: { ...event, data: event.type === 'request/header' ? undefined : event.data } })))
const mark = () => page.evaluate(() => Math.max(0, ...window.liveSession.eventSource.getSnapshot().entries.map(entry => entry.event.seq ?? 0)))
async function send(text, mode = 'queue') {
  const result = await page.evaluate(({ text, mode }) => window.liveSession.prompt([{ type: 'text', text }], mode), { text, mode })
  assert.equal(result.ok, true, JSON.stringify(result.error))
}
async function ended(after) {
  await page.waitForFunction(after => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.seq > after && entry.event.type === 'turn/end'), after, { timeout: 120000 })
  assert.equal(await page.evaluate(() => window.liveSession.getSnapshot().lastAgentError), null)
}
try {
  await page.waitForFunction(id => window.verificationCtx.sessions.list.getSnapshot().byId[id], id)
  await page.evaluate(async id => {
    const ctx = window.verificationCtx
    window.liveReference = ctx.sessions.retain(id, { source: 'live-acceptance' })
    await window.liveReference.ready
    const session = window.liveReference.binding.session
    await session.rename('Remote live acceptance')
    await ctx.uiWorkspace.openSession(id)
    window.liveSession = session
    window.liveObservation = { transient: 0, running: false }
    session.eventSource.subscribe(() => {
      window.liveObservation.transient = Math.max(window.liveObservation.transient, session.eventSource.getSnapshot().entries.filter(entry => entry.type === 'transient').length)
    })
    session.subscribe(() => { window.liveObservation.running ||= session.getSnapshot().running })
  }, id)
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, id)
  const input = page.locator('[contenteditable="true"][role="textbox"]')
  await input.waitFor()
  await input.fill('只回复 DSH_REMOTE_REAL_OK，不要使用工具。')
  await input.press('Enter')
  await page.waitForFunction(() => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'user/message'))
  await page.waitForFunction(() => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'turn/end'), undefined, { timeout: 120000 })
  const result = await page.evaluate(() => ({ snapshot: window.liveSession.getSnapshot(), observation: window.liveObservation, entries: window.liveSession.eventSource.getSnapshot().entries }))
  console.log('native chat', JSON.stringify({ snapshot: result.snapshot, observation: result.observation }))
  assert.equal(result.snapshot.lastAgentError, null)
  assert.equal(result.observation.running, true)
  assert(result.observation.transient > 0)
  assert.equal(result.entries.filter(entry => entry.type === 'transient').length, 0)
  assert(result.entries.some(entry => entry.event.type === 'assistant/message' && JSON.stringify(entry.event.data).includes('DSH_REMOTE_REAL_OK')))
  await page.getByText('DSH_REMOTE_REAL_OK', { exact: true }).waitFor()
  const firstSeqs = result.entries.map(entry => entry.event.seq)
  assert.equal(new Set(firstSeqs).size, firstSeqs.length)

  const questionStart = await mark()
  await send('调用 ask_user_question 工具向我提问：验收选择。问题 id 为 acceptance，选项为“继续验收”和“结束验收”。必须等待我的选择，然后仅回复 DSH_QUESTION_OK 和我选择的选项。不要调用其他工具。')
  await page.waitForFunction(after => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.type === 'event' && entry.event.seq > after && entry.event.type === 'tool/call' && entry.event.data.name === 'ask_user_question'), questionStart, { timeout: 90000 })
  await page.getByRole('radio', { name: '继续验收', exact: true }).waitFor({ timeout: 90000 })
  await page.getByRole('radio', { name: '继续验收', exact: true }).click()
  await page.getByRole('button', { name: /^(提交|Submit)$/ }).click()
  await ended(questionStart)
  const questionEvents = (await entries()).filter(entry => entry.event.seq > questionStart)
  assert(questionEvents.some(entry => entry.event.type === 'tool/result' && JSON.stringify(entry.event.data).includes('继续验收')))
  assert(questionEvents.some(entry => entry.event.type === 'assistant/message' && JSON.stringify(entry.event.data).includes('DSH_QUESTION_OK')))
  console.log('PASS: native question answer reaches the remote model')

  const cancelStart = await mark()
  await send('使用 bash 在当前工作区前台运行 sleep 45，设置 timeoutMs=60000，不要放入后台，不要调用其他工具。这个命令用于验证运行中停止。')
  await page.waitForFunction(after => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.seq > after && entry.event.type === 'tool/call' && entry.event.data.name === 'bash'), cancelStart, { timeout: 90000 })
  await page.waitForFunction(after => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.seq > after && entry.event.type === 'job/registered'), cancelStart)
  assert.equal(await page.evaluate(() => window.liveSession.getSnapshot().running), true)
  await page.getByRole('button', { name: '停止生成', exact: true }).click()
  await ended(cancelStart)
  const cancelEvents = (await entries()).filter(entry => entry.event.seq > cancelStart)
  assert(cancelEvents.some(entry => entry.event.type === 'turn/end' && entry.event.data.reason.kind === 'aborted' && entry.event.data.reason.reason.kind === 'user'))
  assert(cancelEvents.some(entry => entry.event.type === 'job/settled' && entry.event.data.status === 'killed'))
  console.log('PASS: active cancel terminates the remote shell job')

  const queueStart = await mark()
  await send('使用 bash 在当前工作区前台运行 sleep 20，设置 timeoutMs=30000，不放入后台。完成后不要调用其他工具，回复已完成。')
  await page.waitForFunction(after => window.liveSession.eventSource.getSnapshot().entries.some(entry => entry.event.seq > after && entry.event.type === 'tool/call' && entry.event.data.name === 'bash'), queueStart, { timeout: 90000 })
  await send('队列原文：只回复 DSH_QUEUE_ORIGINAL。')
  await page.waitForFunction(() => window.liveSession.projections.get('inbox')?.['next-turn']?.length === 1)
  const dock = page.locator('[data-queue-dock]')
  await dock.getByRole('button', { name: '编辑排队消息', exact: true }).click()
  await dock.getByRole('textbox').fill('只回复 DSH_QUEUE_EDITED，不要使用工具。')
  await dock.getByRole('button', { name: '保存排队消息', exact: true }).click()
  await page.waitForFunction(() => JSON.stringify(window.liveSession.projections.get('inbox')?.['next-turn']).includes('DSH_QUEUE_EDITED'))
  await send('只回复 DSH_QUEUE_REMOVE，不要使用工具。')
  await page.waitForFunction(() => window.liveSession.projections.get('inbox')?.['next-turn']?.length === 2)
  await dock.getByRole('button', { expanded: false }).click()
  await dock.locator('li').filter({ hasText: 'DSH_QUEUE_REMOVE' }).getByRole('button', { name: '删除排队消息', exact: true }).click()
  await page.waitForFunction(() => window.liveSession.projections.get('inbox')?.['next-turn']?.length === 1)
  await dock.getByRole('button', { name: '插话发送', exact: true }).click()
  await page.waitForFunction(() => window.liveSession.projections.get('inbox')?.['next-turn']?.length === 0)
  await ended(queueStart)
  const queueEvents = (await entries()).filter(entry => entry.event.seq > queueStart)
  assert(queueEvents.some(entry => entry.event.type === 'assistant/message' && JSON.stringify(entry.event.data).includes('DSH_QUEUE_EDITED')))
  assert.equal(queueEvents.filter(entry => entry.event.type === 'user/message' && JSON.stringify(entry.event.data).includes('DSH_QUEUE_REMOVE')).length, 0)
  console.log('PASS: native queue edit/remove/steer reaches the remote model')

  const ssh = promisify(execFile)
  for (const decision of ['reject', 'allow']) {
    const approvalStart = await mark()
    const path = `/root/dsh-acceptance-${sessionId}-${decision}.txt`
    await send(`这是审批验收。只调用一次 bash 执行 printf DSH_APPROVAL_OK > ${path}，sandbox_permissions 必须为 danger-full-access，justification 为“验证远端原生审批”。需要等待原生审批；如果被拒绝，不要重试或换工具。最后仅回复实际结果。`)
    const button = page.getByRole('button', { name: decision === 'reject' ? /^(拒绝|Reject)$/ : /^(允许一次|允许|Allow once|Allow)$/ })
    await button.waitFor({ timeout: 90000 })
    await button.click()
    await ended(approvalStart)
    const approvalEvents = (await entries()).filter(entry => entry.event.seq > approvalStart)
    assert(approvalEvents.some(entry => entry.event.type === 'approval/asked'))
    assert(approvalEvents.some(entry => entry.event.type === 'approval/decided'))
    const verification = decision === 'reject' ? `test ! -e ${path}` : `test "$(cat ${path})" = DSH_APPROVAL_OK && rm -- ${path}`
    await ssh('ssh', ['-p', '22', '-o', 'BatchMode=yes', sshAlias, verification], { timeout: 15000 })
    console.log('PASS: native approval', decision, 'verified over SSH')
  }
  assert.deepEqual(errors, [])
  console.log('PASS: successful native chat, question answer, active cancel, queue edit/remove/steer, approval reject/allow')
} finally {
  if (await page.evaluate(() => window.liveSession?.getSnapshot().running)) await page.evaluate(() => window.liveSession.cancel())
  try { await api('workspace/archiveSession', { request: { sessionId } }) }
  finally { await browser.close() }
}

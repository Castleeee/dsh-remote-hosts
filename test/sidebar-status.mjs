import assert from 'node:assert/strict'
import { openLab } from './support/browser.mjs'

const gateway = process.env.DSH_GATEWAY_URL
const host = process.env.DSH_TEST_HOST ?? 'jack'
assert(gateway && process.env.DSH_LAB_URL, 'Set DSH_GATEWAY_URL and DSH_LAB_URL')
async function api(method, request) {
  const response = await fetch(`${gateway}/host/${host}/api/${method}`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request}}})})
  assert.equal(response.status,200)
  const result = (await response.json()).result
  assert.equal(result.ok,true,JSON.stringify(result.error))
  return result.value
}
const {workspace} = await api('workspace/create',{path:'/root/dsh-test'})
const {sessionId} = await api('session/create',{workspaceId:workspace.workspaceId})
const id = `remote:${host}:${sessionId}`
const {browser,page,errors} = await openLab(process.env.DSH_LAB_URL)
const row = page.locator(`[data-dsh-remote-row="session"][data-host-id="${host}"][data-session-id="${sessionId}"]`)
async function send(text) {
  const result = await page.evaluate(text => window.statusSession.prompt([{type:'text',text}],'queue'),text)
  assert.equal(result.ok,true,JSON.stringify(result.error))
}
async function finished() {
  await page.waitForFunction(() => !window.statusSession.getSnapshot().running,undefined,{timeout:120000})
  assert.equal(await page.evaluate(() => window.statusSession.getSnapshot().lastAgentError),null)
}
try {
  await page.waitForFunction(id => window.verificationCtx.sessions.list.getSnapshot().byId[id],id)
  await page.evaluate(async id => {
    const ctx = window.verificationCtx
    window.statusReference = ctx.sessions.retain(id,{source:'sidebar-status-acceptance'})
    await window.statusReference.ready
    window.statusSession = window.statusReference.binding.session
    await window.statusSession.rename('Remote sidebar status acceptance')
    await ctx.uiWorkspace.openSession(id)
  },id)
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id,id)
  const hostRow = page.locator(`[data-dsh-remote-row="host"][data-host-id="${host}"]`)
  if (await hostRow.getAttribute('aria-expanded') === 'false') await hostRow.click()
  await row.waitFor({state:'attached'})
  const workspaceKey = await row.getAttribute('data-workspace-key')
  const workspaceRow = page.locator(`[data-dsh-remote-row="workspace"][data-host-id="${host}"][data-workspace-key="${workspaceKey}"]`)
  if (await workspaceRow.getAttribute('aria-expanded') === 'false') await workspaceRow.click()
  await row.waitFor()

  await send('这是状态验收。使用 bash 在当前目录前台运行 sleep 8，timeoutMs=15000，然后只回复 DSH_STATUS_DONE，不要使用其他工具。')
  await row.locator('[data-state="ongoing"] svg[data-state="ongoing"]').waitFor()
  const spinner = await row.locator('svg[data-state="ongoing"]').evaluate(svg => ({width:svg.getBoundingClientRect().width,animation:getComputedStyle(svg.querySelector('g')).animationName}))
  assert.equal(spinner.width,14)
  assert.notEqual(spinner.animation,'none')
  await page.evaluate(() => window.verificationCtx.uiWorkspace.clearMain())
  await finished()
  await row.locator('[data-state="done"] [data-state="done"]').waitFor()
  assert.equal(await row.getAttribute('aria-description'),'已完成')
  await row.click()
  await page.waitForFunction(id => !window.verificationCtx.uiSession.sessionStatus.getSnapshot().get(id).completionUnread,id)
  await page.waitForFunction(id => document.querySelector(`[data-session-id="${id}"][data-dsh-remote-row="session"]`).dataset.sessionState === 'idle',sessionId)
  assert.equal(await row.locator('[data-state="done"]').count(),0)
  console.log('PASS: native animated spinner, background completion indicator and completion acknowledgement on open')

  await send('只调用一次 ask_user_question，问题为“侧栏状态验收”，提供“继续验收”和“结束验收”两个选项，等待我的回复。收到回复后只回复 DSH_STATUS_ANSWERED，不要使用其他工具。')
  await row.locator('[data-state="warning"] [data-state="warning"]').waitFor({timeout:90000})
  assert.equal(await row.getAttribute('aria-description'),'等待回复')
  await row.getByText('待回复',{exact:true}).waitFor()
  const color = await row.locator('[data-state="warning"] [data-state="warning"]').evaluate(dot => getComputedStyle(dot,'::after').backgroundColor)
  assert.notEqual(color,'rgba(0, 0, 0, 0)')
  await page.evaluate(() => window.verificationCtx.uiWorkspace.clearMain())
  await row.getByText('待回复',{exact:true}).waitFor()
  await row.click()
  await page.getByRole('radio',{name:'继续验收',exact:true}).click()
  await page.getByRole('button',{name:/^(提交|Submit)$/}).click()
  await finished()
  await page.waitForFunction(id => document.querySelector(`[data-session-id="${id}"][data-dsh-remote-row="session"]`).dataset.sessionState === 'idle',sessionId)
  console.log('PASS: real remote question displays native warning dot and reply label across session switches; answer clears the warning')

  await send(`只调用一次 bash 执行 printf DSH_STATUS_APPROVAL，sandbox_permissions 必须为 danger-full-access，justification 为“侧栏审批状态验收”。等待审批，被拒绝后不要重试或换工具，只回复审批已拒绝。`)
  await row.getByText('待审批',{exact:true}).waitFor({timeout:90000})
  assert.equal(await row.getAttribute('aria-description'),'等待审批')
  await row.locator('[data-state="warning"] [data-state="warning"]').waitFor()
  await page.getByRole('button',{name:/^(拒绝|Reject)$/}).click()
  await finished()
  await page.waitForFunction(id => document.querySelector(`[data-session-id="${id}"][data-dsh-remote-row="session"]`).dataset.sessionState === 'idle',sessionId)
  console.log('PASS: native approval warning and compact label follow the real remote approval lifecycle')
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.stop())
  assert.equal(await page.locator('[data-dsh-remote-hosts="sessionStatus"]').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS: status components and subscriptions clean up without page errors')
} finally {
  await page.evaluate(async () => {if(window.statusSession?.getSnapshot().running) await window.statusSession.cancel()})
  await browser.close()
  await api('workspace/archiveSession',{sessionId})
}

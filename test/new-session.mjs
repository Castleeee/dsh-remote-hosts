import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, rm } from 'node:fs/promises'
import { quote } from 'shell-quote'
import { openLab } from './support/browser.mjs'

const execute = promisify(execFile)
const base = `/root/dsh-test/native-new-${randomBytes(4).toString('hex')}`
const target = `${base}-target`
const localPath = new URL(`../.verification/local-new-${randomBytes(4).toString('hex')}`, import.meta.url).pathname
const ssh = args => execute('ssh', ['-p', '22', '-o', 'BatchMode=yes', process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux', quote(args)])
const { browser, page, errors } = await openLab(process.env.DSH_LAB_URL)
const gateway = await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.snapshot().gateway)
const requests = []
page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/host/jack/api/')) requests.push({ endpoint: request.url().split('/api/')[1], args: request.postDataJSON().payload.args }) })
async function api(method, args) {
  const response = await fetch(`${gateway}/host/jack/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
  })
  const result = (await response.json()).result
  assert.equal(result.ok, true, result.error?.message)
  return result.value
}
let workspaceId
let targetWorkspaceId
let localWorkspaceId
try {
  await ssh(['mkdir', '-p', base, target])
  workspaceId = (await api('workspace/create', { request: { path: base } })).workspace.workspaceId
  console.log('created test workspace', workspaceId, base)
  const nativeWorkspaceId = `remote:jack:${workspaceId}`
  const host = page.locator('[data-dsh-remote-row="host"][data-host-id="jack"]')
  if (await host.getAttribute('aria-expanded') !== 'true') await host.click()
  const workspace = page.locator(`[data-dsh-remote-row="workspace"][data-host-id="jack"][data-workspace-key="ws:${workspaceId}"]`)
  const create = workspace.getByRole('button', { name: '在此工作区新建远程会话' })
  await workspace.hover()
  await create.dblclick()
  const input = page.locator('[contenteditable="true"][role="textbox"]')
  await input.waitFor()
  await page.waitForFunction(workspaceId => {
    const ctx = window.verificationCtx
    const id = ctx.uiWorkspace.mainReference?.sessionId
    return id?.startsWith('remote:jack:') && ctx.sessions.list.getSnapshot().byId[id]?.cwd === workspaceId
  }, base)
  const id = await page.evaluate(() => window.verificationCtx.uiWorkspace.mainReference.sessionId)
  assert.equal(await page.getByRole('dialog', { name: '新建远程会话', exact: true }).count(), 0)
  assert.equal(requests.filter(request => request.endpoint === 'session/create').length, 1)
  await page.waitForFunction(id => window.verificationCtx.slots.entries('conversation.hero.agentPreset')[0].inject(id).hooks.agentPresetSeat.getSnapshot().options.length > 0, id)
  const roster = await api('agentPresets/list', {})
  const seat = await page.evaluate(id => {
    const inject = window.verificationCtx.slots.entries('conversation.hero.agentPreset')[0].inject(id)
    return { snapshot: inject.hooks.agentPresetSeat.getSnapshot(), developerTools: inject.hooks.developerTools.getSnapshot() }
  }, id)
  assert.equal(seat.snapshot.error, null)
  assert.deepEqual(seat.snapshot.options.map(option => option.id), roster.presets.filter(preset => preset.broken === undefined).map(preset => preset.id))
  assert(requests.some(request => request.endpoint === 'agentPresets/list'))
  assert(requests.some(request => request.endpoint === 'settings/describe'))
  console.log('PASS: remote workspace + opens the native composer, double click creates once, native Agent menu reads the remote roster and developer preference', JSON.stringify({ current: seat.snapshot.current, options: seat.snapshot.options.map(option => option.id), developerTools: seat.developerTools }))

  const agent = page.locator('button[class*="_seat"]')
  await agent.click()
  const selected = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/agentPresets/select'))
  await page.getByRole('menuitem', { name: /^PTC 模式/ }).click()
  assert.equal((await (await selected).json()).result.ok, true)
  await page.waitForFunction(id => window.verificationCtx.sessions.binding(id).session.projections.get('agentPreset') === 'ptc', id)
  assert.equal((await api('session/list', { _request: {} })).items.find(session => `remote:jack:${session.sessionId}` === id).projections.values.agentPreset, 'ptc')
  assert(Object.values(requests.find(request => request.endpoint === 'agentPresets/select').args).includes(id.slice('remote:jack:'.length)))
  console.log('PASS: choosing PTC in the native menu changes the real remote session and its durable projection')

  const modelTrigger = page.locator('button[aria-haspopup="menu"]').filter({ has: page.locator('svg[data-icon="dsw-icon-data-outline-regular"]') })
  await modelTrigger.click()
  await page.waitForFunction(id => window.verificationCtx.modelDirectories.directoryFor(id).store.getSnapshot().status === 'ready', id)
  const models = await page.evaluate(id => window.verificationCtx.modelDirectories.directoryFor(id).store.getSnapshot().groups.map(group => ({id:group.id,models:group.models.map(model=>model.id)})), id)
  assert(models.some(group => group.id === 'opencode-go' && group.models.length > 0))
  const modelCell = page.getByRole('menuitem', { name: /^模型/ })
  const modelMenu = page.locator(`[id=${JSON.stringify(await modelTrigger.getAttribute('aria-controls'))}]`)
  await modelMenu.waitFor({ state: 'visible' })
  console.log('model menu', await modelMenu.innerText())
  if (await modelCell.count()) await modelCell.click()
  assert.equal(await page.getByRole('menuitemradio', { name: /DeepSeek V4.1 Flash/ }).getAttribute('aria-checked'), 'true')
  await page.getByRole('menuitemradio', { name: /DeepSeek V4.1 Flash/ }).click()
  assert.equal(await page.evaluate(id => window.verificationCtx.modelDirectories.directoryFor(id).store.getSnapshot().current.provider, id), 'opencode-go')
  await page.keyboard.press('Escape')
  console.log('PASS: the native model picker loads the remote OpenCode Go catalog and shows its DeepSeek V4.1 Flash selection')

  await input.fill('DSH_NATIVE_UNSENT_DRAFT')
  await workspace.hover()
  const reused = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/session/create'))
  await create.click()
  assert.equal((await (await reused).json()).result.value.sessionId, id.slice('remote:jack:'.length))
  await page.waitForFunction(id => window.verificationCtx.uiWorkspace.mainReference?.sessionId === id, id)
  assert.equal(await input.innerText(), 'DSH_NATIVE_UNSENT_DRAFT')
  const listed = await api('session/list', { _request: {} })
  assert.equal(listed.items.filter(session => session.cwd === base).length, 1)
  assert.equal(listed.items.find(session => `remote:jack:${session.sessionId}` === id).projections.values.agentPreset, 'ptc')
  const started = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/session/create'))
  await page.evaluate(() => window.verificationCtx.uiWorkspace.startSession())
  assert.equal((await (await started).json()).result.value.sessionId, id.slice('remote:jack:'.length))
  await page.waitForFunction(() => document.querySelector('[contenteditable="true"][role="textbox"]')?.textContent === 'DSH_NATIVE_UNSENT_DRAFT')
  assert.deepEqual(errors, [])
  console.log('PASS: repeated native new-session actions reuse the blank session and preserve the unsent draft')

  await page.getByRole('button', { name: '选择工作区', exact: true }).click()
  await page.getByRole('menuitem', { name: /添加工作区/ }).click()
  const directory = page.getByRole('dialog', { name: '选择远程目录', exact: true })
  await directory.getByRole('combobox', { name: '远程路径' }).fill(target)
  const creation = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/workspace/create'))
  await directory.getByRole('button', { name: '选择目录', exact: true }).click()
  targetWorkspaceId = (await (await creation).json()).result.value.workspace.workspaceId
  await page.waitForFunction(path => {
    const ctx = window.verificationCtx
    return ctx.sessions.list.getSnapshot().byId[ctx.uiWorkspace.mainReference?.sessionId]?.cwd === path
  }, target)
  assert.equal(await input.innerText(), 'DSH_NATIVE_UNSENT_DRAFT')
  await page.getByRole('button', { name: '选择工作区', exact: true }).click()
  await page.getByRole('menuitem', { name: base.split('/').at(-1), exact: true }).click()
  await page.waitForFunction(id => window.verificationCtx.uiWorkspace.mainReference?.sessionId === id, id)
  await page.getByRole('button', { name: '选择工作区', exact: true }).click()
  await page.getByRole('menuitem', { name: target.split('/').at(-1), exact: true }).click()
  await page.waitForFunction(path => {
    const ctx = window.verificationCtx
    return ctx.sessions.list.getSnapshot().byId[ctx.uiWorkspace.mainReference?.sessionId]?.cwd === path
  }, target)
  assert.equal(await input.innerText(), 'DSH_NATIVE_UNSENT_DRAFT')
  assert.equal(await page.getByRole('button', { name: '选择工作区', exact: true }).innerText(), target.split('/').at(-1))
  console.log('PASS: the native workspace menu creates and lists remote workspaces, selects remote directories, and carries the draft into the selected remote workspace')

  await mkdir(localPath)
  localWorkspaceId = await page.evaluate(async path => (await window.verificationCtx.workspaces.create({ path })).workspaceId, localPath)
  const remoteReadsBeforeLocal = requests.filter(request => request.endpoint.startsWith('agentPresets/')).length
  await page.evaluate(workspaceId => window.verificationCtx.uiWorkspace.startSession(workspaceId), localWorkspaceId)
  await page.waitForFunction(path => {
    const ctx = window.verificationCtx
    const id = ctx.uiWorkspace.mainReference?.sessionId
    return id !== undefined && !id.startsWith('remote:') && ctx.sessions.list.getSnapshot().byId[id]?.cwd === path
  }, localPath)
  const localId = await page.evaluate(() => window.verificationCtx.uiWorkspace.mainReference.sessionId)
  await page.waitForFunction(id => window.verificationCtx.slots.entries('conversation.hero.agentPreset')[0].inject(id).hooks.agentPresetSeat.getSnapshot().options.length > 0, localId)
  await page.getByRole('button', { name: '选择工作区', exact: true }).click()
  await page.getByRole('menuitem', { name: localPath.split('/').at(-1), exact: true }).waitFor({ state: 'visible' })
  const localMenu = await page.getByRole('menuitem').allTextContents()
  assert(localMenu.some(text => text.includes(localPath.split('/').at(-1))))
  assert(!localMenu.some(text => text.includes(base.split('/').at(-1))))
  await page.keyboard.press('Escape')
  assert.equal(requests.filter(request => request.endpoint.startsWith('agentPresets/')).length, remoteReadsBeforeLocal)
  assert.deepEqual(errors, [])
  console.log('PASS: native local session creation and workspace/Agent menus remain local after switching from SSH')

  const race = await page.evaluate(async ({remote,local}) => {
    const ctx = window.verificationCtx
    const remoteOpen = ctx.uiWorkspace.openWorkspace(remote)
    const localOpen = ctx.uiWorkspace.openWorkspace(local)
    await Promise.all([remoteOpen,localOpen])
    return ctx.sessions.list.getSnapshot().byId[ctx.uiWorkspace.mainReference.sessionId].cwd
  }, { remote: nativeWorkspaceId, local: localWorkspaceId })
  assert.equal(race, localPath)
  console.log('PASS: a later native navigation keeps the local session selected when a remote creation completes')

  await page.evaluate(id => window.verificationCtx.uiWorkspace.openSession(id), id)
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, id)
  await input.fill('只回复 DSH_NATIVE_NEW_OK，不要使用工具。')
  await input.press('Enter')
  await page.waitForFunction(id => window.verificationCtx.sessions.binding(id).session.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'turn/end'), id, { timeout: 120000 })
  const reply = await page.evaluate(id => {
    const session = window.verificationCtx.sessions.binding(id).session
    return { error: session.getSnapshot().lastAgentError, success: session.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'assistant/message' && JSON.stringify(entry.event.data).includes('DSH_NATIVE_NEW_OK')) }
  }, id)
  assert.equal(reply.error, null)
  assert.equal(reply.success, true)
  assert.equal(await page.evaluate(id => window.verificationCtx.sessions.list.getSnapshot().byId[id].projectionValues.agentPreset,id),'ptc')
  await page.locator('span[class*="_label"][title]').filter({ hasText: /PTC/ }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: a session created through the native remote entry sends through the native composer and receives a real successful model reply')
} finally {
  if (localWorkspaceId !== undefined) await page.evaluate(async ({ workspaceId, path }) => {
    const ctx = window.verificationCtx
    ctx.uiWorkspace.clearMain()
    for (const session of Object.values(ctx.sessions.list.getSnapshot().byId).filter(session => session.cwd === path)) await ctx.workspaces.archiveSession(session.id)
    await ctx.workspaces.delete(workspaceId)
  }, { workspaceId: localWorkspaceId, path: localPath })
  await browser.close()
  for (const [cleanupId, path] of [[workspaceId, base], [targetWorkspaceId, target]]) if (cleanupId !== undefined) {
    const listing = await api('session/list', { _request: {} })
    for (const session of listing.items.filter(session => session.cwd === path)) await api('workspace/archiveSession', { request: { sessionId: session.sessionId } })
    await api('workspace/delete', { request: { workspaceId: cleanupId } })
  }
  await ssh(['rmdir', base, target])
  await rm(localPath, { recursive: true, force: true })
}

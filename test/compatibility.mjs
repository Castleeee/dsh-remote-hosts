import assert from 'node:assert/strict'
import { openLab } from './support/browser.mjs'

const { browser, page, errors } = await openLab(process.env.DSH_LAB_URL)
const gateway = await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.snapshot().gateway)
const commandRequests = []
page.on('request', request => {
  if (request.method() === 'POST' && request.url().endsWith('/api/commands/execute') && request.url().includes('/host/')) commandRequests.push(request.url())
})
let focusId
async function api(method, request) {
  const response = await fetch(`${gateway}/host/jack/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args: { request } } }),
  })
  const result = (await response.json()).result
  assert.equal(result.ok, true, result.error?.message)
  return result.value
}
try {
  await page.locator('[data-dsh-remote-row="host"]').first().waitFor()
  const observation = await page.evaluate(async () => {
    const ctx = window.verificationCtx
    const plugin = window.__DSH_REMOTE_HOSTS__
    await plugin.refresh()
    await new Promise(resolve => setTimeout(resolve, 200))
    const section = document.querySelector('[data-dsh-remote-hosts="section"]')
    const manager = section.querySelector('button')
    manager.focus()
    const rows = [...section.querySelectorAll('[data-dsh-remote-row]')]
    await plugin.refresh()
    await new Promise(resolve => setTimeout(resolve, 200))
    const unchanged = section === document.querySelector('[data-dsh-remote-hosts="section"]')
      && rows.every(row => row.isConnected) && document.activeElement === manager
    const total = ctx.typert.remotes.list().filter(item => item.invocation.kind === 'direct').length
    const routed = plugin.snapshot().native.routedEndpoints
    const unmodifiedOpen = window.verificationMethods.find(item => item.name === 'openSession')
    const unmodifiedScope = window.verificationMethods.find(item => item.name === 'scopeOf')
    plugin.stop()
    const slots = ['conversation.hero.agentPreset', 'conversation.session.header.actions', 'conversation.hero.workspace', 'conversation.hero.workspace.directoryFlow']
      .flatMap(name => ctx.slots.entries(name)).map(entry => ({entry,inject:entry.inject}))
    const restored = window.verificationMethods.every(item => {
      const current = Object.getOwnPropertyDescriptor(item.target, item.name)
      return item.descriptor === undefined ? current === undefined : current?.value === item.descriptor.value
        && current?.get === item.descriptor.get && current?.set === item.descriptor.set
        && current?.configurable === item.descriptor.configurable && current?.writable === item.descriptor.writable && current?.enumerable === item.descriptor.enumerable
    })
    plugin.start()
    const changedSlots = slots.filter(({entry,inject})=>entry.inject!==inject).map(({entry})=>({component:entry.component.name,id:entry.options.id}))
    const scopeUnchanged = ctx.sessions.scopeOf === unmodifiedScope.value
    plugin.stop()
    const restoredSlots = slots.every(({entry,inject})=>entry.inject===inject)
    plugin.start()
    return { unchanged, total, routed, restored, restoredSlots, changedSlots, scopeUnchanged, unmodifiedOpen: Object.getOwnPropertyDescriptor(unmodifiedOpen.target, 'openSession') === undefined, gateway: plugin.snapshot().gateway }
  })
  assert.equal(observation.unchanged, true)
  assert.equal(observation.restored, true)
  assert.equal(observation.restoredSlots, true)
  assert.equal(observation.scopeUnchanged, true)
  assert.equal(observation.routed.includes('session/canOpenWorkspacePath'),false)
  assert.equal(observation.routed.includes('session/initializeDefaultModel'),false)
  assert.equal(observation.changedSlots.filter(entry=>['subagent-catalog','job-list'].includes(entry.id)).length,0)
  assert.equal(observation.changedSlots.filter(entry=>entry.id==='agent-preset').length,1)
  assert.equal(observation.unmodifiedOpen, true)
  assert(observation.routed.length < observation.total)
  assert(observation.routed.every(endpoint => /^(session|workspace|commands|attachment|fileReference|sessionReference)\//.test(endpoint)))
  console.log('native adaptation', JSON.stringify(observation))

  const registration = await page.evaluate(async () => {
    const ctx=window.verificationCtx
    const React=window.verificationRequire('react')
    const header=ctx.slots.entries('conversation.session.header.actions').find(entry=>entry.options.id==='agent-preset')
    const inject=()=>({startSession:()=>ctx.uiWorkspace.startSession()})
    function CompanionHeaderAction({startSession}) {return React.createElement('button',{onClick:startSession},'Companion new session')}
    const fiber=ctx.plugin({name:'remote-hosts-header-companion',apply(owner){
      owner.slots.register({name:'conversation.session.header.actions',id:'companion-new-session',inject,locale:'settings.agentPreset'},CompanionHeaderAction)
    }})
    await fiber.await()
    await new Promise(resolve=>queueMicrotask(resolve))
    const entry=ctx.slots.entries('conversation.session.header.actions').find(entry=>entry.options.id==='companion-new-session')
    const untouched=entry.inject===inject
    const nativeHeaderRetained=ctx.slots.entries('conversation.session.header.actions').includes(header)
    await fiber.dispose()
    await new Promise(resolve=>queueMicrotask(resolve))
    return {untouched,nativeHeaderRetained,removed:!ctx.slots.entries('conversation.session.header.actions').includes(entry),restored:entry.inject===inject}
  })
  assert.deepEqual(registration,{untouched:true,nativeHeaderRetained:true,removed:true,restored:true})
  console.log('PASS: a real companion header plugin keeps its own injection and registration lifecycle')

  const reusedComponent = await page.evaluate(async()=>{
    const ctx=window.verificationCtx
    const native=ctx.slots.entries('conversation.session.header.actions').find(entry=>entry.options.id==='agent-preset')
    const inject=native.inject
    const previous=new Set(ctx.slots.entries('conversation.session.header.actions'))
    const fiber=ctx.plugin({name:'remote-hosts-native-label-companion',apply(owner){
      owner.slots.register({name:'conversation.session.header.actions',id:'agent-preset',priority:-1,locale:'settings.agentPreset',inject},native.component)
    }})
    await fiber.await()
    await new Promise(resolve=>queueMicrotask(resolve))
    const entry=ctx.slots.entries('conversation.session.header.actions').find(entry=>!previous.has(entry))
    const adapted=entry.inject!==inject
    await fiber.dispose()
    await new Promise(resolve=>queueMicrotask(resolve))
    return {adapted,restored:entry.inject===inject,removed:!ctx.slots.entries('conversation.session.header.actions').includes(entry)}
  })
  assert.deepEqual(reusedComponent,{adapted:true,restored:true,removed:true})
  console.log('PASS: a plugin reusing the official Agent label gets remote adaptation; unloading immediately restores its injection')

  const coexistence = await page.evaluate(async () => {
    const ctx = window.verificationCtx
    const plugin = window.__DSH_REMOTE_HOSTS__
    const id = await ctx.sessions.create({ cwd: '/Users/jack/code/dddd' })
    const reference = ctx.sessions.retain(id, { source: 'compatibility-test' })
    await reference.ready
    window.verificationCompatibilityReference=reference
    const scope = ctx.sessions.scopeOf(reference.binding.ctx)
    const command = await ctx.get('remote.commands').execute(id, 'remote:jack:ordinary-command-text', [])
    const literalTitle = await ctx.remote.session.rename({sessionId:id,title:'remote:jack:ordinary-title-text'})
    if (!command.ok || !literalTitle.ok) throw new Error('本地请求被错误路由')
    let calls = 0
    const companions = []
    const fiber = ctx.plugin({ name: 'remote-hosts-compatibility-observer', apply(owner) {
      for (const [target, name] of [[ctx.sessions, 'retain'], [ctx.remote.session, 'list'], [ctx.modelDirectories, 'directoryFor']]) {
        const descriptor = Object.getOwnPropertyDescriptor(target, name)
        const original = target[name]
        const wrapped = function (...args) { calls++; return original.apply(this, args) }
        Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped })
        companions.push({ target, name, wrapped })
        owner.effect(() => () => {
          if (Object.getOwnPropertyDescriptor(target, name)?.value !== wrapped) throw new Error('其他插件的包装被覆盖')
          if (descriptor === undefined) delete target[name]
          else Object.defineProperty(target, name, descriptor)
        })
      }
    } })
    await fiber.await()
    plugin.stop()
    const preserved = companions.every(item => Object.getOwnPropertyDescriptor(item.target, item.name)?.value === item.wrapped)
    const local = ctx.sessions.retain(id, { source: 'compatibility-after-stop' })
    await local.ready
    const listing = await ctx.remote.session.list({})
    const directory = ctx.modelDirectories.directoryFor(id)
    await directory.load()
    local.release()
    await fiber.dispose()
    const after = ctx.sessions.retain(id, { source: 'compatibility-after-observer' })
    await after.ready
    after.release()
    const baseline = window.verificationMethods.map(({ target, name }) => ({ target, name, descriptor: Object.getOwnPropertyDescriptor(target, name) }))
    const sidebar = ctx.slots.entries('sidebar.workspaces')[0]
    const inject = sidebar.inject
    const source = ctx.uiSession.provide({ hooks: ['workspaces'], resolve: () => ({ hooks: { workspaces: ctx.workspaces.list } }) })
    let startupFailure
    try { plugin.start() } catch (error) { startupFailure = error.message }
    const cleanFailure = !plugin.snapshot().started && plugin.snapshot().native === null
      && sidebar.inject === inject && baseline.every(item => {
        const current = Object.getOwnPropertyDescriptor(item.target, item.name)
        return item.descriptor === undefined ? current === undefined : current?.value === item.descriptor.value
      })
      && document.querySelector('[data-dsh-remote-hosts="style"]') === null
    source()
    plugin.start()
    const restarted = plugin.snapshot().native?.patched === true
    reference.release()
    await ctx.get('remote.workspace').archiveSession({ sessionId: id })
    delete window.verificationCompatibilityReference
    return { preserved, calls, listOk: listing.ok, modelStatus: directory.store.getSnapshot().status, startupFailure, cleanFailure, restarted, scope, localId:id, command }
  })
  assert.equal(coexistence.preserved, true)
  assert(coexistence.calls >= 3)
  assert.equal(coexistence.listOk, true)
  assert.equal(coexistence.modelStatus, 'ready')
  assert.match(coexistence.startupFailure, /duplicate/)
  assert.equal(coexistence.cleanFailure, true)
  assert.equal(coexistence.restarted, true)
  assert.equal(coexistence.scope, coexistence.localId)
  assert.equal(coexistence.command.ok, true)
  assert.equal(coexistence.command.value, undefined)
  assert.deepEqual(commandRequests, [])
  console.log('plugin coexistence and startup cleanup', JSON.stringify(coexistence))
  focusId = (await api('session/create', { cwd: '/root/dsh-test' })).sessionId
  await api('session/rename', { sessionId: focusId, title: 'DSH sidebar focus verification' })
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.refresh())
  const onboarding = page.getByRole('dialog').filter({ hasText: '开始使用' })
  await page.addLocatorHandler(onboarding, async () => { await onboarding.getByRole('button', { name: '关闭', exact: true }).click() })
  const host = page.locator('[data-dsh-remote-row="host"][data-host-id="jack"]')
  await host.click()
  const workspace = page.locator('[data-dsh-remote-row="workspace"][data-host-id="jack"][title="/root/dsh-test"]')
  await workspace.click()
  const row = page.locator(`[data-dsh-remote-row="session"][data-host-id="jack"][data-session-id="${focusId}"]`)
  await row.waitFor()
  await row.evaluate(async element => {
    const ctx = window.verificationCtx
    const id = `remote:jack:${element.dataset.sessionId}`
    const reference = ctx.sessions.retain(id, { source: 'sidebar-update-test' })
    await reference.ready
    window.verificationRenamed = { element, reference }
  })
  await row.focus()
  const change = await page.evaluate(async () => {
    const { reference } = window.verificationRenamed
    const title = `DSH sidebar update ${Date.now()}`
    const result = await reference.binding.session.rename(title)
    if (!result.ok) throw new Error(result.error.message)
    return title
  })
  await page.waitForFunction(title => window.verificationRenamed.element.textContent.includes(title), change)
  const retained = await page.evaluate(async () => {
    const { element, reference } = window.verificationRenamed
    const retained = { connected: element.isConnected, focused: document.activeElement === element }
    reference.release()
    return retained
  })
  assert.deepEqual(retained, { connected: true, focused: true })
  assert.deepEqual(errors, [])
  console.log('PASS: stable sidebar nodes and focus across polling and real renames, limited RPC wrapping, exact method restoration, real plugin coexistence and partial-start cleanup')
} finally {
  await page.evaluate(async()=>{
    const reference=window.verificationCompatibilityReference
    if(reference===undefined)return
    reference.release()
    const result=await window.verificationCtx.get('remote.workspace').archiveSession({sessionId:reference.sessionId})
    if(!result.ok)throw new Error(result.error.message)
  })
  await browser.close()
  if (focusId !== undefined) await api('workspace/archiveSession', { sessionId: focusId })
}

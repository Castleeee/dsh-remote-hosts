import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { openLab } from './support/browser.mjs'

const labUrl = process.env.DSH_LAB_URL
assert(labUrl, 'Set DSH_LAB_URL to the authenticated lab URL')
const gateway = process.env.DSH_GATEWAY_URL ?? 'http://127.0.0.1:43130'
const hosts = (process.env.DSH_TEST_HOSTS ?? 'jack,jack-isolation').split(',')
assert.equal(hosts.length, 2, 'Use two independent DSH_HOME environments')

async function api(host, method, args) {
  const response = await fetch(`${gateway}/host/${host}/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
  })
  assert.equal(response.status, 200, `${host} ${method}`)
  const result = (await response.json()).result
  assert.equal(result.ok, true, JSON.stringify(result.error))
  return result.value
}

const sessions = []
for (const host of hosts) {
  const { workspace } = await api(host, 'workspace/create', { request: { path: '/root/dsh-test' } })
  const created = await api(host, 'session/create', { request: { workspaceId: workspace.workspaceId } })
  sessions.push(`remote:${host}:${created.sessionId}`)
}
const { browser, page, errors } = await openLab(labUrl)
page.on('console', message => { if (message.type() === 'error' || message.text().includes('[remote-hosts]')) console.log(message.type(), message.text().slice(0, 400)) })
const requests = []
page.on('request', request => { if (request.url().includes('/api/')) requests.push(new URL(request.url()).pathname) })
try {
  await page.waitForFunction(ids => ids.every(id => window.verificationCtx.sessions.list.getSnapshot().byId[id]), sessions, { timeout: 45000 })
  const result = await page.evaluate(async ids => {
    const ctx = window.verificationCtx
    const localId = await ctx.sessions.create({ cwd: '/Users/jack/code/dddd' })
    const localReference = ctx.sessions.retain(localId, { source: 'integration' })
    await localReference.ready
    const local = localReference.binding
    window.integrationLocalReference = localReference
    const localModels = ctx.get('modelDirectories').directoryFor(localId)
    await localModels.load()
    const localBefore = JSON.stringify(localModels.store.getSnapshot())
    const references = ids.map(id => ctx.sessions.retain(id, { source: 'integration' }))
    await Promise.all(references.map(ref => ref.ready))
    const bindings = references.map(ref => ref.binding)
    const directories = ids.map(id => ctx.get('modelDirectories').directoryFor(id))
    await Promise.all(directories.map(directory => directory.load()))
    const rename = await Promise.all(bindings.map((binding, index) => binding.session.rename(`Remote integration ${index + 1}`)))
    const command = await bindings[0].session.command('/permission')
    const scopedCommands = await bindings[0].ctx.remote.commands.list()
    const cancel = await bindings[0].session.cancel()
    const actual = {
      ids,
      localId,
      localUnchanged: local === ctx.sessions.binding(localId) && localBefore === JSON.stringify(localModels.store.getSnapshot()),
      isolatedCatalogs: directories[0].catalog !== directories[1].catalog && directories[0].catalog !== localModels.catalog && directories[1].catalog !== localModels.catalog,
      scopes: bindings.map(binding => ctx.sessions.scopeOf(binding.ctx)),
      scopedRemotes: bindings.map(binding => binding.ctx.remote.$host.isLoopback),
      rename, command, cancel, scopedCommands: { ok: scopedCommands.ok, count: scopedCommands.value?.length },
      models: directories.map(directory => directory.store.getSnapshot()),
      counts: ids.map(id => ctx.sessions.retainInfo(id).getSnapshot().referenceCount),
    }
    window.integrationReferences = references
    return actual
  }, sessions)
  console.log('sessions and models', JSON.stringify(result))
  assert.equal(result.localUnchanged, true)
  assert.equal(result.isolatedCatalogs, true)
  assert.deepEqual(result.scopes, sessions)
  assert.deepEqual(result.scopedRemotes, [false, false])
  for (const rename of result.rename) assert.equal(rename.ok, true)
  assert.equal(result.command.ok, true)
  assert.equal(result.command.value.matched, true)
  assert.equal(result.cancel.ok, true)
  assert.equal(result.scopedCommands.ok, true)
  for (const count of result.counts) assert(count >= 1)

  const selection = await page.evaluate(async id => {
    const ctx = window.verificationCtx
    const directory = ctx.modelDirectories.directoryFor(id)
    const group = directory.store.getSnapshot().groups.find(group => group.models.length > 0)
    if (group === undefined) throw new Error('The first remote host needs an available model for selection acceptance')
    const selected = { provider: group.id, model: group.models[0].id }
    const outcome = await directory.select(selected)
    return { selected, outcome }
  }, sessions[0])
  assert.equal(selection.outcome.ok, true, JSON.stringify(selection.outcome.error))
  await page.waitForFunction(({ id, selected }) => {
    const ctx = window.verificationCtx
    const current = ctx.modelDirectories.directoryFor(id).store.getSnapshot().current
    const projected = ctx.sessions.binding(id).session.projections.get('modelSelection')?.next
    return current?.provider === selected.provider && current?.model === selected.model
      && projected?.provider === selected.provider && projected?.model === selected.model
  }, { id: sessions[0], selected: selection.selected })
  console.log('PASS: native model selection updates the remote durable projection')

  const contents = await readFile(new URL('../README.md', import.meta.url))
  const upload = await page.evaluate(async ({ id, bytes }) => {
    const ctx = window.verificationCtx
    return ctx.fileUpload.upload(id, new Uint8Array(bytes), 'README.md')
  }, { id: sessions[0], bytes: [...contents] })
  console.log('attachment upload', JSON.stringify(upload))
  assert.equal(upload.ok, true)

  await page.evaluate(id => window.verificationCtx.uiWorkspace.openSession(id), sessions[0])
  await page.waitForFunction(id => window.verificationCtx.uiSession.adapter.current.getSnapshot().key === id, sessions[0])
  await page.waitForFunction(id => window.verificationCtx.sessions.binding(id).session.projections.get('title') === 'Remote integration 1', sessions[0])
  console.log('native conversation opened')
  await page.locator('[contenteditable="true"][role="textbox"]').waitFor()
  assert.equal((await page.locator('body').innerText()).includes('选择一个工作区开始'), false)
  console.log('native blank-session composer enabled')

  if (process.env.DSH_TEST_PROMPT === '1') {
    await page.evaluate(id => {
      const session = window.verificationCtx.sessions.binding(id).session
      window.integrationPrompt = { transient: 0, running: false }
      session.eventSource.subscribe(() => {
        window.integrationPrompt.transient = Math.max(window.integrationPrompt.transient, session.eventSource.getSnapshot().entries.filter(entry => entry.type === 'transient').length)
      })
      session.subscribe(() => { window.integrationPrompt.running ||= session.getSnapshot().running })
    }, sessions[0])
    const input = page.locator('[contenteditable="true"][role="textbox"]')
    await input.fill('只回复 DSH_REMOTE_REAL_OK，不要使用工具。')
    await input.press('Enter')
    await page.waitForFunction(id => window.verificationCtx.sessions.binding(id).session.eventSource.getSnapshot().entries.some(entry => entry.event.type === 'turn/end'), sessions[0], { timeout: 90000 })
    const prompt = await page.evaluate(id => {
      const session = window.verificationCtx.sessions.binding(id).session
      return { observations: window.integrationPrompt, snapshot: session.getSnapshot(), transientRemaining: session.eventSource.getSnapshot().entries.filter(entry => entry.type === 'transient').length }
    }, sessions[0])
    console.log('real native composer prompt', JSON.stringify(prompt))
    assert.equal(prompt.observations.running, true)
    assert.equal(prompt.snapshot.running, false)
    assert.equal(prompt.transientRemaining, 0)
    await page.getByText('只回复 DSH_REMOTE_REAL_OK，不要使用工具。', { exact: true }).first().waitFor()
    if (process.env.DSH_EXPECT_MODEL_SUCCESS === '1') assert.equal(prompt.snapshot.lastAgentError, null)
  }

  if (process.env.DSH_HISTORY_SESSION) {
    const historyId = `remote:${hosts[0]}:${process.env.DSH_HISTORY_SESSION}`
    const history = await page.evaluate(async id => {
      const ctx = window.verificationCtx
      const reference = ctx.sessions.retain(id, { source: 'integration-history' })
      await reference.ready
      const binding = reference.binding
      const { SessionEventStream } = window.verificationRequire('@deepseek-ai/dsh-api-session-controller/client')
      let entries = []
      let hasMore
      let failure
      const stream = new SessionEventStream(binding.ctx.remote, { kind: 'session', sessionId: id }, {
        publish: change => {
          if (change.type === 'replace') entries = [...change.entries]
          else if (change.type === 'prepend') entries.unshift(...change.entries)
          else if (change.type === 'append') entries.push(change.entry)
          hasMore = change.hasMore ?? hasMore
        },
        failed: error => { failure = error.message },
      })
      try {
        await stream.open({ maxMessages: 2 })
        const tail = { count: entries.length, first: entries[0].event.seq, hasMore }
        await stream.prepend({ beforeSeq: tail.first, maxMessages: 2 })
        const older = { count: entries.length, first: entries[0].event.seq, hasMore }
        const unique = new Set(entries.map(entry => entry.event.seq)).size === entries.length
        const imagePart = binding.eventSource.getSnapshot().entries.flatMap(entry => entry.event.data?.message?.content ?? entry.event.data?.content ?? []).find(part => part.type === 'image' && part.attachment)
        const image = imagePart ? await binding.session.readAttachment(imagePart.attachment) : undefined
        return { tail, older, unique, failure, image: image === undefined ? undefined : { ok: image.ok, bytes: image.value?.data.length } }
      } finally {
        await stream.dispose()
        reference.release()
      }
    }, historyId)
    console.log('real history pagination', JSON.stringify(history))
    assert.equal(history.tail.hasMore, true)
    assert(history.older.count > history.tail.count)
    assert(history.older.first < history.tail.first)
    assert.equal(history.unique, true)
    assert.equal(history.failure, undefined)
    if (history.image) assert.equal(history.image.ok, true)
  }

  const release = await page.evaluate(async ids => {
    const ctx = window.verificationCtx
    const before = ids.map(id => ctx.sessions.retainInfo(id).getSnapshot().referenceCount)
    const references = window.integrationReferences
    for (const reference of references) { reference.release(); reference.release() }
    await Promise.resolve()
    const after = ids.map(id => ctx.sessions.retainInfo(id).getSnapshot().referenceCount)
    let releasedThrows = false
    try { references[0].binding } catch { releasedThrows = true }
    return { before, after, releasedThrows }
  }, sessions)
  assert.equal(release.releasedThrows, true)
  release.before.forEach((count, index) => assert.equal(release.after[index], count - 1))
  console.log('reference cleanup', JSON.stringify(release))

  const stopped = await page.evaluate(() => {
    const ctx = window.verificationCtx
    window.__DSH_REMOTE_HOSTS__.stop()
    return { snapshot: window.__DSH_REMOTE_HOSTS__.snapshot(), remoteIds: ctx.sessions.list.getSnapshot().ids.filter(id => id.startsWith('remote:')), methods: ['binding', 'retain', 'using', 'scopeOf'].map(name => Object.getOwnPropertyDescriptor(ctx.sessions, name) === undefined) }
  })
  assert.deepEqual(stopped.remoteIds, [])
  assert.equal(stopped.snapshot.started, false)
  assert.equal(stopped.snapshot.native, null)
  assert(stopped.methods.every(Boolean))
  console.log('stopped', JSON.stringify(stopped))
  await page.waitForTimeout(200)
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.start())
  console.log('restarted', await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.snapshot()))
  await page.waitForFunction(() => window.__DSH_REMOTE_HOSTS__.snapshot().native?.patched === true)
  await page.waitForFunction(id => window.verificationCtx.sessions.list.getSnapshot().byId[id], sessions[0])
  console.log('stop and restart passed')
  await page.evaluate(() => window.integrationLocalReference.release())
  assert(requests.some(path => path.includes(`/host/${hosts[0]}/api/commands/execute`)))
  assert(requests.some(path => path.includes(`/host/${hosts[1]}/api/session/rename`)))
  assert.deepEqual(errors, [])
  console.log('PASS: native history, commands, cancel, upload, two-host isolation, local regression, references, cleanup and restart')
} finally {
  for (let index = 0; index < sessions.length; index++) {
    await api(hosts[index], 'workspace/archiveSession', { request: { sessionId: sessions[index].split(':').slice(2).join(':') } })
  }
  await browser.close()
}

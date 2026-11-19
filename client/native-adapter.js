import { Lifetime } from './lifetime.js'
import { remoteIdentity, remoteInvocationIdentity } from './transport.js'
import { installRemoteAgentPresets } from './remote-agent-presets.js'
import { installRemoteWorkspacePicker } from './remote-workspace-picker.js'
import { adaptSlot } from './slot-adapter.js'

// 仅处理原生根上下文确实调用、且带有会话或工作区身份的命名空间。
const routedEndpoints = new Set([
  'commands/execute',
  ...['attachment', 'cancel', 'create', 'events', 'follow', 'fork', 'observeEvent', 'observeProjections', 'observeState', 'openWorkspacePath', 'page', 'projections', 'prompt', 'rename', 'selectModel', 'state', 'updateQueue', 'wait', 'workspacePathApplications'].map(method => `session/${method}`),
  ...['archiveSession', 'delete', 'insertBefore', 'insertSessionBefore', 'pinSession', 'rename', 'unarchiveSession', 'unpinSession'].map(method => `workspace/${method}`),
])

export function installNativeAdapter(ctx, runtime, native, lifetime, operations) {
  const { nativeRecord, retainNative, retainObserver, workspaceRecord, hostTransport, ensureNativeRows, syncSidebarSelection, connectRemoteWorkspace, createRemoteWorkspace, pickRemoteDirectory, gateway } = operations
  const sessions = ctx.sessions
  const patches = new Lifetime()
  lifetime.defer(() => patches.dispose())
  const connecting = new Map()
  const creation = new AbortController()
  lifetime.defer(() => creation.abort(new Error('远程机器插件已经停用')))
  // DSH 0.2.2-rc.1 的原生 openWorkspace 在此处连接空白会话，继续使用原生导航、通知与草稿初始化。
  patches.wrap(ctx.uiWorkspace, 'connectBlank', (next, id, options = {}) => {
    const parsed = remoteIdentity(id)
    if (parsed === undefined) return next(id, options)
    const key = JSON.stringify([id, options.agentPreset])
    if (connecting.has(key)) return connecting.get(key)
    const attempt = connectRemoteWorkspace(parsed.hostId, parsed.rawId, options, creation.signal).finally(() => {
      if (connecting.get(key) === attempt) connecting.delete(key)
    })
    connecting.set(key, attempt)
    return attempt
  })
  patches.wrap(ctx.uiWorkspace, 'startSession', (next, id, options) => {
    if (id !== undefined) return next(id, options)
    const current = ctx.uiWorkspace.mainReference?.sessionId
    const parsed = remoteIdentity(current)
    if (parsed === undefined) return next(id, options)
    const workspace = workspaceRecord(parsed.hostId).source.getSnapshot().items.find(item => item.sessionIds.includes(current))
    if (workspace === undefined) throw new Error('当前远程会话没有可用的工作区')
    return next(workspace.workspaceId, options)
  })
  installRemoteAgentPresets(ctx, lifetime, hostTransport)
  installRemoteWorkspacePicker(ctx, lifetime, workspaceRecord, hostTransport, createRemoteWorkspace, pickRemoteDirectory)
  let sidebarInput
  let sidebarSnapshot
  const localSessions = {
    getSnapshot() {
      const input = sessions.list.getSnapshot()
      if (input !== sidebarInput) {
        sidebarInput = input
        const ids = input.ids.filter(id => remoteIdentity(id) === undefined)
        sidebarSnapshot = { ...input, ids, byId: Object.fromEntries(ids.map(id => [id, input.byId[id]])) }
      }
      return sidebarSnapshot
    },
    subscribe: listener => sessions.list.subscribe(listener),
  }
  adaptSlot(ctx.slots, lifetime, 'sidebar.workspaces', entry => entry.locale === 'workspace' && entry.component.name === 'WorkspaceBrowser',
    (next, ...args) => {
      const injected = next(...args)
      return { ...injected, hooks: { ...injected.hooks, sessions: localSessions, workspaces: ctx.workspaces.list } }
    })
  patches.wrap(ctx.uiSession, 'materializeAbsent', next => {
    const binding = next()
    delete binding.hooks.workspaces
    return binding
  })
  lifetime.defer(ctx.uiSession.provide({
    hooks: ['workspaces'],
    resolve: binding => {
      const parsed = remoteIdentity(binding.sessionId)
      return { hooks: { workspaces: parsed === undefined ? ctx.workspaces.list : workspaceRecord(parsed.hostId).source } }
    },
  }))
  patches.wrap(sessions, 'binding', (next, id) => remoteIdentity(id) === undefined ? next(id) : native.records.get(id)?.binding)
  patches.wrap(sessions, 'retainInfo', (next, id) => remoteIdentity(id) === undefined ? next(id) : retainObserver(id).source)
  patches.wrap(sessions, 'retain', (next, target, options) => {
    const parsed = remoteIdentity(target)
    return parsed === undefined ? next(target, options) : retainNative(nativeRecord(parsed.hostId, parsed.rawId), options)
  })
  patches.wrap(sessions, 'using', async (next, target, options, operation) => {
    const parsed = remoteIdentity(target)
    if (parsed === undefined) return next(target, options, operation)
    const reference = retainNative(nativeRecord(parsed.hostId, parsed.rawId), options)
    try { await reference.ready; return await operation(reference) } finally { reference.release() }
  })
  patches.wrap(sessions, 'scope', (next, id) => remoteIdentity(id) === undefined ? next(id) : native.records.get(id)?.binding.ctx)
  patches.wrap(sessions, 'sessionOf', (next, owner) => {
    const id = sessions.scopeOf(owner)
    return remoteIdentity(id) === undefined ? next(owner) : native.records.get(id)?.binding.session
  })
  patches.wrap(sessions, 'retainAgentScope', (next, id) => {
    const parsed = remoteIdentity(id)
    return parsed === undefined ? next(id) : retainNative(nativeRecord(parsed.hostId, parsed.rawId), { source: 'remote-event' })
  })

  async function upload(sessionId, data, name, mediaType, signal) {
    const parsed = remoteIdentity(sessionId)
    const query = new URLSearchParams({ sessionId: parsed.rawId })
    if (name !== undefined) query.set('name', name)
    if (mediaType !== undefined) query.set('mediaType', mediaType)
    const init = { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: data, signal }
    if (data instanceof ReadableStream) init.duplex = 'half'
    const response = await fetch(`${gateway}/host/${encodeURIComponent(parsed.hostId)}/api/session/uploadFileBinary?${query}`, init)
    const body = await response.json()
    if (!response.ok || body?.ok !== true) return { ok: false, error: { code: body?.error?.code ?? 'upload-failed', message: body?.error?.message ?? `HTTP ${response.status}` } }
    return { ok: true, value: body.value }
  }
  patches.wrap(ctx.fileUpload, 'upload', (next, id, data, name, signal) => remoteIdentity(id) === undefined ? next(id, data, name, signal) : upload(id, data, name, undefined, signal))
  patches.wrap(ctx.fileUpload, 'uploadImage', (next, id, data, mediaType, name, signal) => remoteIdentity(id) === undefined ? next(id, data, mediaType, name, signal) : upload(id, data, mediaType, name, signal))

  const directories = new WeakMap()
  patches.wrap(ctx.modelDirectories, 'directoryFor', (next, id) => {
    const parsed = remoteIdentity(id)
    if (parsed === undefined) return next(id)
    const binding = sessions.binding(id)
    if (binding === undefined) throw new Error(`远程会话 ${id} 尚未保留`)
    if (directories.has(binding)) return directories.get(binding)
    let catalog = native.catalogs.get(parsed.hostId)
    if (catalog === undefined) {
      catalog = new ctx.modelDirectories.catalog.constructor({ remote: hostTransport(parsed.hostId).remote })
      native.catalogs.set(parsed.hostId, catalog)
    }
    const directory = new runtime.ModelDirectory(
      hostTransport(parsed.hostId).remote.session, id, () => true, catalog,
      binding.session.projections.faceOf('modelSelection'), () => binding.session.getSnapshot().blank,
    )
    directories.set(binding, directory)
    binding.ctx.effect(() => () => { directory.dispose(); directories.delete(binding) }, 'remote-hosts: model directory')
    return directory
  })
  patches.wrap(ctx.remoteAccess, 'source', (next, kind, id, action) => {
    const parsed = remoteIdentity(id)
    return parsed === undefined ? next(kind, id, action) : hostTransport(parsed.hostId).access.resource(kind, parsed.rawId, action)
  })
  patches.wrap(ctx.remoteAccess, 'whenResourceAccess', function (next, kind, id, action, callback) {
    const parsed = remoteIdentity(id)
    return parsed === undefined ? next(kind, id, action, callback)
      : runtime.whenAllowed(this.ctx, hostTransport(parsed.hostId).access.resource(kind, parsed.rawId, action), callback, `remote ${parsed.hostId} access`)
  })

  native.routedEndpoints = []
  for (const descriptor of ctx.typert.remotes.list()) {
    if (descriptor.invocation.kind !== 'direct' || !routedEndpoints.has(`${descriptor.namespace}/${descriptor.method}`)) continue
    const namespace = ctx.get(`remote.${descriptor.namespace}`)
    if (typeof namespace?.[descriptor.method] !== 'function') throw new Error(`DSH 接口 ${descriptor.namespace}/${descriptor.method} 不可用`)
    patches.wrap(namespace, descriptor.method, (next, ...args) => {
      const parsed = remoteInvocationIdentity(descriptor, args)
      return parsed === undefined ? next(...args) : hostTransport(parsed.hostId).remote[descriptor.namespace][descriptor.method](...args)
    })
    native.routedEndpoints.push(`${descriptor.namespace}/${descriptor.method}`)
  }
  lifetime.defer(ctx.uiWorkspace.selection.subscribe(syncSidebarSelection))
  lifetime.defer(sessions.list.subscribe(ensureNativeRows))
}

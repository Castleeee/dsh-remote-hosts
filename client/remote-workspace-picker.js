import { adaptSlot } from './slot-adapter.js'
import { remoteIdentity } from './transport.js'

export function installRemoteWorkspacePicker(ctx, lifetime, workspaceRecord, hostTransport, createRemoteWorkspace, pickRemoteDirectory) {
  const selection = ctx.uiWorkspace.selection
  const localWorkspaces = ctx.workspaces.list
  const selectedHost = () => lifetime.active ? remoteIdentity(selection.getSnapshot().sessionId)?.hostId : undefined
  const source = () => {
    const hostId = selectedHost()
    return hostId === undefined ? localWorkspaces : workspaceRecord(hostId).source
  }
  const workspaces = {
    getSnapshot: () => source().getSnapshot(),
    subscribe(listener) {
      let stop = source().subscribe(listener)
      const select = selection.subscribe(() => { stop(); stop = source().subscribe(listener); listener() })
      return () => { select(); stop() }
    },
  }
  for (const name of ['conversation.hero.workspace', 'conversation.hero.workspace.directoryFlow']) {
    adaptSlot(ctx.slots, lifetime, name,
      entry => name === 'conversation.hero.workspace' ? entry.locale === 'workspace' && entry.component.name === 'WorkspacePicker'
        : ['NativeDirectoryFlow', 'BrowseDirectoryFlow'].includes(entry.component.name),
      (next, ...args) => {
        const injected = next(...args)
        if (name === 'conversation.hero.workspace') return {
          ...injected,
          hooks: { ...injected.hooks, workspaces },
          createWorkspace: input => {
            const hostId = selectedHost()
            return hostId === undefined ? injected.createWorkspace(input) : createRemoteWorkspace(hostId, input)
          },
        }
        if (injected.listDirectory !== undefined) return {
          ...injected,
          listDirectory: async (path, signal) => {
            const hostId = selectedHost()
            if (hostId === undefined) return injected.listDirectory(path, signal)
            const result = await hostTransport(hostId).remote.directoryPicker.list(path, signal)
            if (!result.ok) throw new Error(result.error.message)
            return result.value
          },
          createDirectory: async (path, name) => {
            const hostId = selectedHost()
            if (hostId === undefined) return injected.createDirectory(path, name)
            const result = await hostTransport(hostId).remote.directoryPicker.createDirectory(path, name)
            if (!result.ok) throw new Error(result.error.message)
            return result.value
          },
        }
        if (injected.pick !== undefined) return {
          ...injected,
          pick: () => {
            const hostId = selectedHost()
            return hostId === undefined ? injected.pick() : pickRemoteDirectory(hostId)
          },
        }
        return injected
      })
  }
}

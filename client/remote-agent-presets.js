import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { adaptSlot } from './slot-adapter.js'
import { remoteIdentity } from './transport.js'

function remoteSeat(binding, remote) {
  const session = binding.session
  const store = createSnapshotStore({ options: [], current: '', error: null, busy: false, introduce: false })
  const developerTools = createSnapshotStore(false)
  let loading
  let active = true
  const set = patch => { if (active) store.set({ ...store.getSnapshot(), ...patch }) }
  const current = () => session.projections.get('agentPreset') ?? ''
  const sync = () => { if (!store.getSnapshot().busy) set({ current: current() }) }
  const unsubscribe = session.projections.faceOf('agentPreset').subscribe(sync)
  const load = () => loading ??= (async () => {
    try {
      const [roster, settings] = await Promise.all([remote.agentPresets.list(), remote.settings.describe()])
      if (!roster.ok) throw new Error(roster.error.message)
      if (!settings.ok) throw new Error(settings.error.message)
      if (!active) return
      developerTools.set(settings.value.namespaces.find(item => item.ns === 'ui-settings')?.value?.enabled ?? false)
      const options = roster.value.presets.filter(preset => preset.broken === undefined).map(({ id, name, description }) => ({
        id, ...(name === undefined ? {} : { name }), ...(description === undefined ? {} : { description }),
      }))
      set({ options, current: current(), error: null })
    } catch (error) {
      set({ error: error.message })
    } finally { loading = undefined }
  })()
  const select = async id => {
    if (store.getSnapshot().busy || !session.getSnapshot().blank) return
    set({ busy: true, error: null })
    try {
      const result = await remote.agentPresets.select(binding.sessionId, id)
      if (!result.ok) throw new Error(result.error.details?.reason ?? result.error.message)
      set({ current: result.value })
    } catch (error) {
      set({ current: current(), error: { reason: error.message, preset: store.getSnapshot().options.find(option => option.id === id) ?? { id } } })
      return error.message
    } finally { set({ busy: false }) }
  }
  return {
    store, developerTools, load, select,
    dismissRefusal(error) { if (store.getSnapshot().error === error) set({ error: error.reason }) },
    introduced() {},
    dispose() { active = false; unsubscribe() },
  }
}

export function installRemoteAgentPresets(ctx, lifetime, hostTransport) {
  const seats = new Map()
  lifetime.defer(() => { for (const seat of seats.values()) seat.dispose(); seats.clear() })
  const seatFor = id => {
    const parsed = remoteIdentity(id)
    if (parsed === undefined) return undefined
    const binding = ctx.sessions.binding(id)
    if (binding === undefined) throw new Error(`远程会话 ${id} 尚未保留`)
    if (!seats.has(binding)) {
      const seat = remoteSeat(binding, hostTransport(parsed.hostId).remote)
      seats.set(binding, seat)
      binding.ctx.effect(() => () => { seat.dispose(); seats.delete(binding) }, 'remote-hosts: Agent preset binding')
    }
    return seats.get(binding)
  }
  for (const [name, hero] of [['conversation.hero.agentPreset', true], ['conversation.session.header.actions', false]]) {
    adaptSlot(ctx.slots, lifetime, name,
      entry => entry.locale === 'settings.agentPreset' && (hero ? entry.component.name === 'AgentPresetSeat'
        : entry.options.id === 'agent-preset' && entry.component.name === 'AgentPresetLabel'),
      (next, id, ...args) => {
        if (remoteIdentity(id) === undefined) return next(id, ...args)
        const injected = hero ? undefined : next(id, ...args)
        const seat = seatFor(id)
        if (!hero) return { ...injected, hooks: { ...injected.hooks, agentPresets: seat.store }, load: seat.load }
        return { hooks: { agentPresetSeat: seat.store, developerTools: seat.developerTools }, load: seat.load,
          select: seat.select, dismissRefusal: seat.dismissRefusal, introduced: seat.introduced }
      })
  }
}

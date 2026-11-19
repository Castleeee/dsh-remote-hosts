import { Lifetime } from './lifetime.js'

// 只跟踪指定插槽里的目标组件；移除注册时立即释放对应包装。
export function adaptSlot(slots, lifetime, name, matches, intercept) {
  const entries = new Map()
  const reconcile = () => {
    const desired = new Set(slots.entries(name).filter(matches))
    for (const [entry, patch] of entries) {
      if (desired.has(entry)) continue
      patch.dispose()
      entries.delete(entry)
    }
    for (const entry of desired) {
      if (entries.has(entry)) continue
      const patch = new Lifetime()
      patch.wrap(entry, 'inject', intercept)
      entries.set(entry, patch)
    }
  }
  lifetime.defer(() => {
    for (const patch of entries.values()) patch.dispose()
    entries.clear()
  })
  lifetime.defer(slots.subscribe(name, reconcile))
  reconcile()
}

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'

export function sidebarStatus(session) {
  const pending = {
    approval: { state:'warning', label:'等待审批', trailing:'待审批' },
    'plan-review': { state:'warning', label:'等待计划确认', trailing:'待确认' },
    question: { state:'warning', label:'等待回复', trailing:'待回复' },
  }[session.pendingInteraction]
  if (pending !== undefined) return pending
  if (session.running) return { state:'ongoing', label:'运行中' }
  if (session.completionUnread) return { state:'done', label:'已完成' }
  return { state:'idle', label:'空闲' }
}

export function createSidebarStatusRenderer() {
  const roots = new Map()
  return {
    sync(section) {
      const present = new Set(section.querySelectorAll('[data-dsh-remote-hosts="sessionStatus"]'))
      for (const [element, entry] of roots) {
        if (present.has(element)) continue
        entry.root.unmount()
        roots.delete(element)
      }
      for (const element of present) {
        const state = element.dataset.state
        let entry = roots.get(element)
        if (entry === undefined) {
          if (state === 'idle') continue
          entry = { root:createRoot(element) }
          roots.set(element, entry)
        }
        if (entry.state === state) continue
        entry.state = state
        entry.root.render(state === 'idle' ? null : createElement(StateDot, {state}))
      }
    },
    dispose() {
      for (const {root} of roots.values()) root.unmount()
      roots.clear()
    },
  }
}

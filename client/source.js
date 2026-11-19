// 复用原生会话数据层与行样式，SSH 分组位于本地动画列表之后。
// 侧栏来源过滤远端身份，运行时适配在停用时恢复。
import { openSshManager } from './host-manager.js'
import { attachPathCompletion } from './path-completion.js'
import { Lifetime } from './lifetime.js'
import { assertCompatible, gatewayAddress, sidebarSelectors } from './compatibility.js'
import { installNativeAdapter } from './native-adapter.js'
import { remoteIdentity as parseNativeId } from './transport.js'
import morphdom from 'morphdom'
import { sidebarStatus, createSidebarStatusRenderer } from './sidebar-status.js'

export default function createPlugin(runtime) {
  const MARK = 'data-dsh-remote-hosts'
  let GATEWAY
  const VERSION = window.__DSH_BOOT__?.release?.version ?? 'unknown'
  const LOG = '[remote-hosts]'
  const statusRenderer = createSidebarStatusRenderer()
  const state = {
    started: false,
    loadGeneration: 0,
    stopped: false,
    rendering: false,
    misses: 0,
    lastJSON: '',
    data: { hosts: [] },
    timer: undefined,
    observer: undefined,
    section: undefined,
    localHeading: undefined,
    templates: {},
    templateRevision: 0,
    renderTimer: undefined,
    groups: new Map(),
    style: undefined,
    expandedHosts: new Set(),
    expandedWorkspaces: new Set(),
    workspaces: new Map(),
    events: new Map(),
    dialog: undefined,
    native: {
      ctx: undefined,
      patched: false,
      lifetime: undefined,
      records: new Map(),
      transports: new Map(),
      catalogs: new Map(),
      retainObservers: new Map(),
      repairing: false,
    },
  }

  const log = (...args) => console.info(LOG, ...args)
  const warn = (...args) => console.warn(LOG, ...args)
  // ---- anchors (see README "Injected DOM") -------------------------------
  function findSidebar() {
    const cols = [...document.querySelectorAll(sidebarSelectors.sidebar)]
    return cols.find(el => el.offsetParent !== null) ?? cols[0] ?? null
  }

  function findRegion() {
    const sidebar = findSidebar()
    return sidebar?.querySelector(sidebarSelectors.tree)?.closest(sidebarSelectors.region) ?? null
  }

  function findList(region) {
    return region?.querySelector(sidebarSelectors.tree) ?? null
  }

  function findTemplates(list) {
    const group = [...list?.querySelectorAll(sidebarSelectors.group) ?? []].find(row => !row.closest(`[${MARK}]`)) ?? null
    const session = [...list?.querySelectorAll(sidebarSelectors.session) ?? []].find(row => !row.closest(`[${MARK}]`)) ?? null
    for (const [key, element] of [['group', group], ['session', session]]) {
      if (element !== null && state.templates[key]?.className !== element.className) {
        state.templates[key] = element.cloneNode(true)
        state.templateRevision++
      }
    }
    return {group:state.templates.group,session:state.templates.session}
  }

  // ---- rendering ---------------------------------------------------------
  function addStyle() {
    if (state.style !== undefined) return
    const style = document.createElement('style')
    style.setAttribute(MARK, 'style')
    style.textContent = `
      [class*="_treeBody"]:has(>[${MARK}="section"]){overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin;padding-bottom:16px}
      [class*="_treeBody"]:has(>[${MARK}="section"])>[role="tree"]{flex:0 0 auto;min-height:auto;overflow:visible;scrollbar-gutter:auto;padding-bottom:0}
      [class*="_treeBody"]:has(>[${MARK}="section"])>[class*="_fade"]{display:none}
      [${MARK}="section"]{display:contents}
      [data-dsh-remote-row][hidden]{display:none!important}
      [data-dsh-remote-row]{box-sizing:border-box}
      [data-dsh-remote-row="session"][aria-selected="true"]{background-color:var(--dsw-alias-interactive-bg-hover)}
      [${MARK}="sessionStatus"]{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none}
      [data-dsh-remote-row="workspace"] [class*="_projectText"]{flex-direction:row;align-items:center}
      [data-dsh-remote-row="workspace"] [class*="_title"]{flex:1;min-width:0}
      [${MARK}="count"]{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
      [data-dsh-remote-row="workspace"] [class*="_arrow"]{transform:none}
      [data-dsh-remote-row="workspace"][aria-expanded="true"] [class*="_arrow"]{transform:rotate(90deg)}
      [data-dsh-remote-row="workspace"] [class*="_folder"]{color:var(--dsw-alias-label-tertiary)}
      [data-dsh-remote-row="workspace"][data-active="true"] [class*="_folder"]{color:var(--dsw-alias-state-business-primary)}
      [${MARK}="hostBadge"]{flex:none;padding:1px 5px;border-radius:var(--dsw-radius-xs,4px);font-size:10px;line-height:14px;
        color:var(--dsw-alias-label-tertiary, #888)}
      [${MARK}="dot"]{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;vertical-align:middle;
        background:#c9a227}
      [${MARK}="dot"][data-online="true"]{background:#2f9e44}
      [${MARK}="dot"][data-online="false"]{background:#c92a2a}
      [${MARK}="row"]{display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:12px;cursor:pointer;
        color:var(--dsw-alias-label-primary, inherit)}
      [${MARK}="row"]:hover{background:var(--dsw-alias-bg-layer-3, rgba(127,127,127,.12))}
      [${MARK}="row"][data-depth="1"]{padding-left:24px}
      [${MARK}="row"][data-depth="2"]{padding-left:38px}
      [${MARK}="muted"]{color:var(--dsw-alias-label-tertiary, #888);font-size:11px}
      [${MARK}="divider"]{display:flex;align-items:center;gap:6px;min-height:34px;padding:0 var(--dsh-sidebar-row-padding,16px);margin-top:8px;
        cursor:pointer;user-select:none}
      [${MARK}="dividerChevron"]{display:inline-flex;flex:none;width:12px;height:16px;align-items:center;justify-content:center;
        color:var(--dsw-alias-label-tertiary,#888);transition:transform .12s ease}
      [${MARK}="divider"][aria-expanded="true"] [${MARK}="dividerChevron"]{transform:rotate(90deg)}
      [${MARK}="dividerLabel"]{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#ddd);white-space:nowrap}
      [${MARK}="dividerLine"]{flex:1;min-width:0}
      [${MARK}="action"]{display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;width:24px;height:24px;border:0;
        border-radius:var(--dsw-radius-xs,4px);background:transparent;color:var(--dsw-alias-label-tertiary,#888);font:inherit;font-size:16px;line-height:20px;cursor:pointer}
      [${MARK}="action"]:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-interactive-bg-hover)}
      [${MARK}="action"]:focus-visible,[data-dsh-remote-row]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
      [${MARK}="dialogBackdrop"]{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.35)}
      [${MARK}="dialog"]{width:380px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:10px;
        padding:14px;background:var(--dsw-alias-bg-layer-1,#1b1b1b);color:var(--dsw-alias-label-primary,#eee);
        box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:12px;line-height:18px}
      [${MARK}="dialog"] h3{margin:0 0 4px;font-size:14px}
      [${MARK}="dialog"] label{display:block;margin:10px 0 4px;color:var(--dsw-alias-label-secondary,#888)}
      [${MARK}="dialog"] input{width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#444);
        background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:12px}
      [${MARK}="dialogActions"]{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      [${MARK}="dialogActions"] button{font:inherit;font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#444);
        background:transparent;color:inherit;cursor:pointer}
      [${MARK}="dialogActions"] button[type=submit]{background:var(--dsw-alias-brand-primary,#4c6ef5);border-color:transparent;color:#fff}
      [${MARK}="dialogActions"] button:disabled{opacity:.5;cursor:default}
      [${MARK}="dialogError"]{margin-top:8px;color:#c92a2a;white-space:pre-wrap}
      [${MARK}="pathField"]{position:relative}
      [${MARK}="pathViewport"]{height:min(180px,25vh);margin-top:5px;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:7px;overflow:hidden}
      [${MARK}="pathSuggestions"]{height:100%;overflow:auto}
      [${MARK}="pathSuggestions"][hidden]{display:none}
      [${MARK}="pathSuggestions"] button{display:block;width:100%;padding:5px 8px;border:0;text-align:left;background:transparent;color:inherit;font:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      [${MARK}="pathSuggestions"] button:disabled{cursor:progress}
      [${MARK}="pathSuggestions"] button:hover,[${MARK}="pathSuggestions"] button[aria-selected="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15))}
      [${MARK}="pathStatus"]{margin-top:5px;height:32px;overflow:auto;color:var(--dsw-alias-label-tertiary,#888);font-size:11px;line-height:16px}
      [${MARK}="pathStatus"][data-error="true"]{color:var(--dsw-alias-state-error-primary,#c92a2a)}
      [${MARK}="localHeading"],[${MARK}="manageBar"]{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 var(--dsh-sidebar-row-padding,16px);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
      [${MARK}="manageBar"]{justify-content:space-between;margin-top:12px}
      [${MARK}="manageButton"]{font:inherit;font-size:11px;padding:3px 8px;border-radius:6px;border:0;
        background:transparent;color:var(--dsw-alias-label-secondary,#888);cursor:pointer}
      [${MARK}="manageButton"]:hover{color:var(--dsw-alias-label-primary,#eee)}
      [${MARK}="hostManager"]{position:relative;width:460px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;border:1px solid var(--dsw-alias-border-l1,#444);
        border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-1,#1b1b1b);color:var(--dsw-alias-label-primary,#eee);
        box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:12px;line-height:18px}
      [${MARK}="hostManager"] h3{margin:0 0 8px;font-size:14px}
      [${MARK}="hostManagerRow"]{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#333)}
      [${MARK}="hostManagerRow"] .meta{color:var(--dsw-alias-label-tertiary,#888);font-size:11px}
      [${MARK}="hostManagerSubhead"]{margin-top:10px;color:var(--dsw-alias-label-tertiary,#888);font-size:11px}
      [${MARK}="hostManagerRow"] .actions{display:flex;gap:4px;margin-left:auto}
      [${MARK}="hostManagerRow"] .actions button{margin-left:0;font:inherit;font-size:11px;padding:2px 6px;border-radius:5px;
        border:1px solid var(--dsw-alias-border-l1,#444);background:transparent;color:inherit;cursor:pointer}
      [${MARK}="sshHosts"]{max-height:40vh;overflow:auto;margin:10px 0}
      [${MARK}="hostManagerRow"]{flex-wrap:wrap}
      [${MARK}="hostManagerRow"] .meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%}
      [${MARK}="sshCommand"],[${MARK}="sshChallenge"]{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      [${MARK}="sshChallenge"][hidden]{display:none}
      [${MARK}="sshChallenge"] label{flex-basis:100%;white-space:pre-wrap;overflow-wrap:anywhere}
      [${MARK}="installConfirmation"]{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:8px}
      [${MARK}="installConfirmation"][hidden]{display:none}
      [${MARK}="installConfirmation"] h4{margin:0 0 8px;font:inherit;font-weight:600}
      [${MARK}="installConfirmation"] p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
      [${MARK}="installConfirmation"] button+button{margin-left:8px}
      [${MARK}="hostManager"] input{flex:1;min-width:120px;box-sizing:border-box;padding:7px 10px;border-radius:8px;
        border:1px solid var(--dsw-alias-border-l1,#888);background:transparent;color:inherit;font:inherit}
      [${MARK}="hostManager"] button{font:inherit;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l1,#888);border-radius:6px;padding:5px 8px;cursor:pointer}
      [${MARK}="hostManager"] button:disabled{opacity:.5;cursor:default}
      [${MARK}="hostManagerStatus"]{margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere}
      [${MARK}="hostManagerStatus"][data-error="true"]{color:var(--dsw-alias-state-error-primary,#c92a2a)}
    `
    document.head.appendChild(style)
    state.style = style
  }

  function relativeTime(ms) {
    if (!Number.isFinite(ms)) return ''
    const delta = Math.max(0, Date.now() - ms)
    const minutes = Math.floor(delta / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时`
    return `${Math.floor(hours / 24)} 天`
  }

  function makeDot(online) {
    const dot = document.createElement('span')
    dot.setAttribute(MARK, 'dot')
    dot.dataset.online = online ? 'true' : 'false'
    return dot
  }

  function makeBadge(text) {
    const badge = document.createElement('span')
    badge.setAttribute(MARK, 'hostBadge')
    badge.textContent = text
    return badge
  }

  function workspaceTitle(cwd) {
    if (typeof cwd !== 'string' || cwd === '') return '未分组'
    const parts = cwd.split('/').filter(Boolean)
    return parts.at(-1) ?? cwd
  }

  function workspaceGroups(host, sessions) {
    const record = state.workspaces.get(host.id)
    const archived = new Set(Array.isArray(record?.archivedSessionIds) ? record.archivedSessionIds : [])
    sessions = sessions.filter(session => !archived.has(session.sessionId))
    const items = Array.isArray(record?.items) ? record.items : []
    const matched = new Set()
    const groups = []
    for (const item of items) {
      const workspaceSessions = sessions.filter(session => {
        if (matched.has(session.sessionId)) return false
        if (Array.isArray(item.sessionIds) && item.sessionIds.includes(session.sessionId)) return true
        if (typeof item.path !== 'string' || item.path === '') return false
        return session.cwd === item.path || (typeof session.cwd === 'string' && session.cwd.startsWith(item.path + '/'))
      })
      for (const session of workspaceSessions) matched.add(session.sessionId)
      groups.push({
        key: `ws:${item.workspaceId}`,
        workspaceId: item.workspaceId,
        cwd: item.path,
        title: item.title !== '' && item.title !== undefined ? item.title : workspaceTitle(item.path),
        sessions: workspaceSessions,
      })
    }
    const byCwd = new Map()
    for (const session of sessions) {
      if (matched.has(session.sessionId)) continue
      const cwd = typeof session.cwd === 'string' ? session.cwd : ''
      const key = cwd === '' ? '(unknown)' : cwd
      if (!byCwd.has(key)) byCwd.set(key, { key, cwd, sessions: [] })
      byCwd.get(key).sessions.push(session)
    }
    for (const group of byCwd.values()) {
      groups.push({
        key: `cwd:${group.key}`,
        cwd: group.cwd,
        title: workspaceTitle(group.cwd),
        sessions: group.sessions,
      })
    }
    return groups
  }

  function actionButton(label, title, handler, template) {
    const button = template?.cloneNode(true) ?? document.createElement('button')
    button.type = 'button'
    if (template === undefined) {
      button.setAttribute(MARK, 'action')
      button.textContent = label
    }
    button.removeAttribute('aria-keyshortcuts')
    button.title = title
    button.setAttribute('aria-label', title)
    button.onclick = event => {
      event.preventDefault()
      event.stopPropagation()
      handler()
    }
    return button
  }

  function hostDivider(host) {
    const divider = document.createElement('div')
    divider.setAttribute(MARK, 'divider')
    divider.dataset.dshRemoteRow = 'host'
    divider.dataset.hostId = host.id
    divider.dataset.rowKey = `remote-host:${host.id}`
    divider.setAttribute('aria-expanded', String(state.expandedHosts.has(host.id)))
    divider.setAttribute('role', 'treeitem')
    divider.tabIndex = -1
    const chevron = document.createElement('span')
    chevron.setAttribute(MARK, 'dividerChevron')
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    arrow.setAttribute('width', '12')
    arrow.setAttribute('height', '12')
    arrow.setAttribute('aria-hidden', 'true')
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    use.setAttribute('href', '#dsw-icon-triangle-right-fill-regular')
    arrow.append(use)
    chevron.append(arrow)
    const label = document.createElement('span')
    label.setAttribute(MARK, 'dividerLabel')
    label.textContent = host.label
    const line = document.createElement('span')
    line.setAttribute(MARK, 'dividerLine')
    divider.append(chevron, makeDot(host.online), label, makeBadge('SSH'), line,
      actionButton('+', '新建远程工作区', () => openWorkspaceDialog(host)))
    return divider
  }

  function clearRowState(row) {
    for (const element of [row, ...row.querySelectorAll('*')]) {
      for (const name of [...element.classList]) {
        if (/_(selected|menuOpen|archived|dropBefore|dropAfter|folderActive|arrowOpen)$/.test(name)) element.classList.remove(name)
      }
      element.removeAttribute('data-scrolled')
      element.removeAttribute('data-clipped')
    }
  }

  function setWorkspaceExpanded(row, expanded) {
    row.setAttribute('aria-expanded', String(expanded))
    const folder = row.querySelector('[class*="_folder"] svg')
    if (folder !== null) {
      const icon = `dsw-icon-folder-${expanded ? 'open' : 'close'}-regular`
      folder.setAttribute('data-icon', icon)
      folder.querySelector('use')?.setAttribute('href', `#${icon}`)
    }
  }

  /** 复用原生行的结构与样式，交互状态由远端侧栏维护。 */
  function hostRow(host, template, sessions) {
    const group = template.group?.cloneNode(false) ?? document.createElement('div')
    group.dataset.dshRemoteGroup = host.id
    const workspaceTemplate = template.group?.querySelector('[class*="_projectRow"]') ?? null
    group.append(hostDivider(host))
    const hostExpanded = state.expandedHosts.has(host.id)

    for (const workspace of workspaceGroups(host, sessions)) {
      let workspaceRow = workspaceTemplate?.cloneNode(true) ?? null
      if (workspaceRow === null) {
        workspaceRow = document.createElement('div')
        workspaceRow.setAttribute(MARK, 'row')
        workspaceRow.append(document.createTextNode(workspace.title ?? workspaceTitle(workspace.cwd)))
      } else {
        clearRowState(workspaceRow)
        workspaceRow.removeAttribute('draggable')
        const workspaceTitleEl = workspaceRow.querySelector('[class*="_title"]')
        if (workspaceTitleEl !== null) {
          workspaceTitleEl.textContent = workspace.title ?? workspaceTitle(workspace.cwd)
        }
        workspaceRow.querySelector('[class*="_rowActions"]')?.remove()
        workspaceRow.querySelector('[class*="_meta"]')?.remove()
      }
      workspaceRow.dataset.dshRemoteRow = 'workspace'
      workspaceRow.dataset.hostId = host.id
      workspaceRow.dataset.workspaceKey = workspace.key
      workspaceRow.dataset.rowKey = `remote-workspace:${host.id}:${workspace.key}`
      workspaceRow.setAttribute('role', 'treeitem')
      workspaceRow.tabIndex = -1
      workspaceRow.title = workspace.cwd === '' ? '未分组' : workspace.cwd
      const count = document.createElement('span')
      count.setAttribute(MARK, 'count')
      count.textContent = String(workspace.sessions.length)
      count.setAttribute('aria-label', `${workspace.sessions.length} 个会话`)
      workspaceRow.append(count)
      const workspaceExpanded = state.expandedWorkspaces.has(`${host.id}:${workspace.key}`)
      setWorkspaceExpanded(workspaceRow, workspaceExpanded)
      if (workspace.workspaceId !== undefined) {
        const actionTemplate = workspaceTemplate?.querySelector('[class*="_rowActions"] button:last-child')
        const action = actionButton('+', '在此工作区新建远程会话', () => state.native.ctx.uiWorkspace.startSession(nativeId(host.id, workspace.workspaceId)), actionTemplate ?? undefined)
        const actions = workspaceTemplate?.querySelector('[class*="_rowActions"]')?.cloneNode(false)
        if (actions !== undefined) {
          actions.append(action)
          workspaceRow.append(actions)
        } else workspaceRow.append(action)
      }
      workspaceRow.hidden = !hostExpanded
      group.append(workspaceRow)

      for (const session of workspace.sessions) {
        const row = sessionRow(host, session, template.session)
        row.dataset.workspaceKey = workspace.key
        row.hidden = !hostExpanded || !workspaceExpanded
        group.append(row)
      }
    }
    return group
  }

  /** Clone a native session row; keeps the shipped row styling. */
  function sessionRow(host, session, template) {
    const row = template?.cloneNode(true) ?? null
    const status = sidebarStatus(session)
    const title = state.native.records.get(nativeId(host.id, session.sessionId))?.binding.session.projections.get('title') ?? session.projections?.values?.title ?? session.title
      ?? session.cwd?.split('/').filter(Boolean).at(-1) ?? session.sessionId
    if (row === null) {
      const fallback = document.createElement('div')
      fallback.setAttribute(MARK, 'row')
      fallback.dataset.depth = '1'
      fallback.dataset.dshRemoteRow = 'session'
      fallback.dataset.hostId = host.id
      fallback.dataset.sessionId = session.sessionId
      fallback.dataset.rowKey = `remote-session:${host.id}:${session.sessionId}`
      fallback.append(document.createTextNode(title))
      const meta = document.createElement('span')
      meta.setAttribute(MARK, 'muted')
      meta.dataset.updatedAt = String(session.updatedAt ?? '')
      meta.dataset.running = String(session.running === true)
      meta.textContent = `${relativeTime(session.updatedAt)}${session.running ? ' · 运行中' : ''}`
      fallback.append(meta)
      appendSessionStatus(fallback, session, status)
      return fallback
    }
    row.dataset.dshRemoteRow = 'session'
    row.dataset.hostId = host.id
    row.dataset.sessionId = session.sessionId
    row.dataset.rowKey = `remote-session:${host.id}:${session.sessionId}`
    row.removeAttribute('draggable')
    clearRowState(row)
    row.setAttribute('aria-selected', 'false')
    row.tabIndex = -1
    const titleEl = row.querySelector('[class*="_title"]')
    if (titleEl !== null) titleEl.textContent = title
    const timeEl = row.querySelector('[class*="_time"]')?.cloneNode(false) ?? document.createElement('span')
    // 本地会话的状态和操作不属于复制出的远端会话。
    for (const child of [...row.children]) {
      if (child === titleEl) continue
      if (child.matches('[class*="_slot"]')) child.replaceChildren()
      else child.remove()
    }
    appendSessionStatus(row, session, status)
    if (session.blank !== true && titleEl !== null) {
      timeEl.className = [...titleEl.classList].find(name => name.endsWith('_title')).replace(/_title$/, '_time')
      timeEl.textContent = status.trailing ?? relativeTime(session.updatedAt)
      if (status.trailing === undefined) timeEl.dataset.updatedAt = String(session.updatedAt ?? '')
      row.append(timeEl)
    }
    return row
  }

  function appendSessionStatus(row, session, status) {
    row.dataset.sessionState = status.state
    row.setAttribute('aria-description', status.label)
    let slot = row.querySelector('[class*="_slot"]')
    if (slot === null) { slot = document.createElement('span');row.prepend(slot) }
    const indicator = document.createElement('span')
    indicator.setAttribute(MARK, 'sessionStatus')
    indicator.dataset.state = session.blank === true ? 'idle' : status.state
    indicator.setAttribute('role','img')
    indicator.setAttribute('aria-label',status.label)
    indicator.title = status.label
    slot.append(indicator)
  }

  function createSection() {
    const section = document.createElement('section')
    section.setAttribute(MARK, 'section')
    section.setAttribute('data-dsh-remote-section', 'true')
    const manageBar = document.createElement('div')
    manageBar.setAttribute(MARK, 'manageBar')
    const manageLabel = document.createElement('span')
    manageLabel.textContent = 'SSH 机器'
    const manageButton = document.createElement('button')
    manageButton.type = 'button'
    manageButton.setAttribute(MARK, 'manageButton')
    manageButton.textContent = '机器管理'
    manageButton.onclick = event => {
      event.preventDefault()
      event.stopPropagation()
      openHostManager()
    }
    manageBar.append(manageLabel, manageButton)
    section.append(manageBar)
    section.addEventListener('click', onSectionClick)
    return section
  }

  function hostView(host) {
    return { id: host.id, label: host.label, sshAlias: host.sshAlias, online: host.online,
      workspaces: state.workspaces.get(host.id)?.snapshot,
      sessions: (host.sessions ?? []).map(session => ({
        sessionId: session.sessionId, cwd: session.cwd, blank: session.blank, running: session.running, updatedAt: session.updatedAt,
        ...sessionStatusFacts(host.id, session),
        title: state.native.records.get(nativeId(host.id, session.sessionId))?.binding.session.projections.get('title') ?? session.projections?.values?.title ?? session.title,
      })),
    }
  }

  function sessionStatusFacts(hostId, session) {
    const id = nativeId(hostId, session.sessionId)
    const status = state.native.ctx.uiSession.sessionStatus.getSnapshot().get(id)
    const summary = state.native.ctx.sessions.list.getSnapshot().byId[id]
    return { blank:summary?.blank ?? session.blank, running:status?.running ?? session.running, completionUnread:status?.completionUnread === true, pendingInteraction:status?.pendingInteraction?.kind }
  }

  function updateTimes() {
    for (const element of state.section?.querySelectorAll('[data-updated-at]') ?? []) {
      const value = `${relativeTime(Number(element.dataset.updatedAt))}${element.dataset.running === 'true' ? ' · 运行中' : ''}`
      if (element.textContent !== value) element.textContent = value
    }
  }

  function removeInjected() {
    statusRenderer.dispose()
    state.section?.remove()
    state.section = undefined
    state.localHeading?.remove()
    state.localHeading = undefined
    state.groups.clear()
    state.lastJSON = ''
  }

  function render() {
    if (state.stopped || state.rendering) return
    state.rendering = true
    try {
      const region = findRegion()
      const list = findList(region)
      if (region === null || list === null) {
        state.misses += 1
        if (state.misses >= 8) throw new Error(`DSH ${VERSION} 的工作区侧栏结构不兼容`)
        scheduleRender(800)
        return
      }
      state.misses = 0
      if (state.section === undefined) state.section = createSection()
      const section = state.section
      if (section.previousElementSibling !== list) { list.after(section); observe() }
      if (state.localHeading?.nextElementSibling !== list) {
        state.localHeading?.remove()
        const localHeading = document.createElement('div')
        localHeading.setAttribute(MARK, 'localHeading')
        localHeading.textContent = '本机'
        list.before(localHeading)
        state.localHeading = localHeading
      }
      const templates = findTemplates(list)
      const views = state.data.hosts.map(hostView)
      const json = JSON.stringify([state.templateRevision, views])
      if (json === state.lastJSON) { updateTimes(); return }
      const desired = new Set(views.map(view => view.id))
      for (const [id, group] of state.groups) {
        if (!desired.has(id)) { group.element.remove(); state.groups.delete(id) }
      }
      let previous = section.firstElementChild
      for (let index = 0; index < views.length; index++) {
        const view = views[index]
        const signature = JSON.stringify([state.templateRevision, view])
        let group = state.groups.get(view.id)
        if (group?.signature !== signature) {
          let element = hostRow(state.data.hosts[index], templates, view.sessions)
          if (group !== undefined) element = morphdom(group.element, element, {
            getNodeKey: node => node.dataset?.rowKey,
            onBeforeElUpdated: (current, incoming) => {
              if (current.getAttribute(MARK) === 'sessionStatus') {
                for (const name of incoming.getAttributeNames()) current.setAttribute(name, incoming.getAttribute(name))
                return false
              }
              current.onclick = incoming.onclick
              return !current.isEqualNode(incoming)
            },
          })
          group = { element, signature }
          state.groups.set(view.id, group)
        }
        if (previous.nextElementSibling !== group.element) previous.after(group.element)
        previous = group.element
      }
      syncSidebarSelection()
      state.lastJSON = json
      updateTimes()
      statusRenderer.sync(section)
    } finally {
      state.rendering = false
    }
  }

  function closeDialog() {
    state.dialog?.dispose?.()
    state.dialog?.remove()
    state.dialog = undefined
  }

  function showDialog(options) {
    closeDialog()
    const backdrop = document.createElement('div')
    backdrop.setAttribute(MARK, 'dialogBackdrop')
    const panel = document.createElement('div')
    panel.setAttribute(MARK, 'dialog')
    panel.setAttribute('role','dialog')
    panel.setAttribute('aria-modal','true')
    panel.setAttribute('aria-label',options.title)
    const title = document.createElement('h3')
    title.textContent = options.title
    const subtitle = document.createElement('div')
    subtitle.setAttribute(MARK, 'muted')
    subtitle.textContent = options.subtitle ?? ''
    const form = document.createElement('form')
    const label = document.createElement('label')
    label.textContent = options.label ?? ''
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = options.placeholder ?? ''
    input.value = options.value ?? ''
    input.id = `remote-dialog-${crypto.randomUUID()}`
    label.htmlFor = input.id
    const error = document.createElement('div')
    error.setAttribute(MARK, 'dialogError')
    error.hidden = true
    const actions = document.createElement('div')
    actions.setAttribute(MARK, 'dialogActions')
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = '取消'
    cancel.onclick = closeDialog
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.textContent = options.submitText ?? '确定'
    actions.append(cancel, submit)
    form.append(label, input, error, actions)
    const paths = options.listDirectories && attachPathCompletion({input,mark:MARK,listDirectories:options.listDirectories})
    backdrop.dispose = () => { paths?.dispose(); options.onClose?.() }
    panel.append(title, subtitle, form)
    backdrop.append(panel)
    backdrop.onclick = event => { if (event.target === backdrop) closeDialog() }
    input.onkeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
      }
    }
    let busy = false
    form.onsubmit = async event => {
      event.preventDefault()
      if (busy) return
      busy = true
      submit.disabled = true
      error.hidden = true
      try {
        const value = paths ? await paths.resolve(input.value.trim()) : input.value.trim()
        await options.onSubmit(value)
        if (state.dialog === backdrop) closeDialog()
      } catch (failure) {
        error.hidden = false
        error.textContent = failure instanceof Error ? failure.message : String(failure)
      } finally {
        busy = false
        submit.disabled = false
      }
    }
    document.body.appendChild(backdrop)
    state.dialog = backdrop
    setTimeout(() => input.focus(), 0)
  }

  function openWorkspaceDialog(host) {
    showDialog({
      title: '新建远程工作区',
      subtitle: `${host.label} · ${host.sshAlias ?? ''}`,
      label: '远程路径',
      placeholder: '/root/project',
      value: '~/',
      submitText: '创建工作区',
      listDirectories: (path,signal) => callApi(host.id,'directoryPicker/list',path === undefined ? {} : {path},signal),
      onSubmit: async value => {
        if (value === '') throw new Error('路径不能为空')
        await callApi(host.id, 'workspace/create', { request: { path: value } })
        await load()
      },
    })
  }

  async function connectRemoteWorkspace(hostId, workspaceId, options, signal) {
    const host = state.data.hosts.find(host => host.id === hostId)
    const workspaces = workspaceRecord(hostId)
    const workspace = workspaces.items.find(item => item.workspaceId === workspaceId)
    if (host === undefined || workspace === undefined) throw new Error('远程工作区已不可用，请检查机器连接。')
    const sessions = await fetchSessions(hostId, signal)
    const blank = sessions.find(session => session.blank && session.cwd === workspace.path
      && workspace.sessionIds.includes(session.sessionId) && !workspaces.archivedSessionIds.includes(session.sessionId)
      && (options.agentPreset === undefined || typeof session.projections?.values?.agentPreset !== 'string' || session.projections.values.agentPreset === options.agentPreset))
    const preset = options.agentPreset ?? blank?.projections?.values?.agentPreset
    const request = { workspaceId, ...(blank === undefined ? {} : { sessionId: blank.sessionId }),
      ...(typeof preset === 'string' ? { agentPreset: preset } : {}) }
    const result = await callApi(hostId, 'session/create', { request }, signal)
    signal.throwIfAborted()
    const currentHost = state.data.hosts.find(host => host.id === hostId)
    if (currentHost === undefined) throw new Error('远程机器已经移除')
    const refreshed = await fetchSessions(hostId, signal)
    signal.throwIfAborted()
    currentHost.sessions = refreshed
    ensureNativeRows()
    return nativeId(hostId, result.sessionId)
  }

  async function createRemoteWorkspace(hostId, request) {
    const { workspace } = await callApi(hostId, 'workspace/create', { request })
    applyWorkspaceFrame(workspaceRecord(hostId), { type: 'upsert', workspace })
    return { ...workspace, workspaceId: nativeId(hostId, workspace.workspaceId), sessionIds: workspace.sessionIds.map(id => nativeId(hostId, id)) }
  }

  function pickRemoteDirectory(hostId) {
    const host = state.data.hosts.find(host => host.id === hostId)
    if (host === undefined) throw new Error('远程机器已经移除')
    return new Promise(resolve => showDialog({
      title: '选择远程目录', subtitle: host.label, label: '远程路径', value: '~/', submitText: '选择目录',
      listDirectories: (path, signal) => callApi(hostId, 'directoryPicker/list', path === undefined ? {} : { path }, signal),
      onSubmit: path => {
        if (path === '') throw new Error('路径不能为空')
        resolve(path)
      },
      onClose: () => resolve(null),
    }))
  }

  function openHostManager() {
    closeDialog()
    state.dialog = openSshManager({ gateway:GATEWAY,mark:MARK,close:closeDialog,connected:load })
  }

  function onSectionClick(event) {
    const row = event.target?.closest?.('[data-dsh-remote-row]')
    if (row === null || row === undefined) return
    if (row.dataset.dshRemoteRow === 'host') {
      const group = row.closest('[data-dsh-remote-group]')
      const expanded = row.getAttribute('aria-expanded') === 'true'
      if (expanded) state.expandedHosts.delete(row.dataset.hostId)
      else state.expandedHosts.add(row.dataset.hostId)
      row.setAttribute('aria-expanded', expanded ? 'false' : 'true')
      for (const workspace of group?.querySelectorAll?.('[data-dsh-remote-row="workspace"]') ?? []) {
        workspace.hidden = expanded
      }
      for (const session of group?.querySelectorAll?.('[data-dsh-remote-row="session"]') ?? []) {
        session.hidden = expanded || !state.expandedWorkspaces.has(`${row.dataset.hostId}:${session.dataset.workspaceKey}`)
      }
      return
    }
    if (row.dataset.dshRemoteRow === 'workspace') {
      const group = row.closest('[data-dsh-remote-group]')
      const expanded = row.getAttribute('aria-expanded') === 'true'
      const key = `${row.dataset.hostId}:${row.dataset.workspaceKey}`
      if (expanded) state.expandedWorkspaces.delete(key)
      else state.expandedWorkspaces.add(key)
      setWorkspaceExpanded(row, !expanded)
      for (const session of group?.querySelectorAll?.('[data-dsh-remote-row="session"]') ?? []) {
        if (session.dataset.workspaceKey === row.dataset.workspaceKey) session.hidden = expanded
      }
      return
    }
    if (row.dataset.dshRemoteRow === 'session') {
      openNativeSession(row.dataset.hostId, row.dataset.sessionId)
    }
  }

  function syncSidebarSelection() {
    const selected = state.native.ctx?.uiWorkspace.selection.getSnapshot().sessionId
    for (const row of state.section?.querySelectorAll('[data-dsh-remote-row="session"]') ?? []) {
      row.setAttribute('aria-selected', String(nativeId(row.dataset.hostId, row.dataset.sessionId) === selected))
    }
    const active = state.section?.querySelector('[data-dsh-remote-row="session"][aria-selected="true"]')
    for (const row of state.section?.querySelectorAll('[data-dsh-remote-row="workspace"]') ?? []) {
      row.dataset.active = String(active !== undefined && active !== null && row.dataset.hostId === active.dataset.hostId && row.dataset.workspaceKey === active.dataset.workspaceKey)
    }
  }

  // ---- remote workspace state --------------------------------------------
  function workspaceRecord(hostId) {
    let record = state.workspaces.get(hostId)
    if (record === undefined) {
      record = { hostId, items: [], archivedSessionIds: [], pinnedSessionIds: [], socket: undefined, timer: undefined, listeners: new Set() }
      record.source = {
        getSnapshot: () => record.snapshot ??= { items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'loading', phase: 'pending', error: null },
        subscribe: listener => { record.listeners.add(listener); return () => record.listeners.delete(listener) },
      }
      state.workspaces.set(hostId, record)
    }
    return record
  }

  function applyWorkspaceState(record, baseline) {
    record.items = Array.isArray(baseline?.items) ? baseline.items : []
    record.archivedSessionIds = Array.isArray(baseline?.archivedSessionIds) ? baseline.archivedSessionIds : []
    record.pinnedSessionIds = Array.isArray(baseline?.pinnedSessionIds) ? baseline.pinnedSessionIds : []
  }

  function applyWorkspaceFrame(record, value) {
    if (value === undefined || value === null) return
    if (value.type === 'baseline') {
      applyWorkspaceState(record, value.value)
    } else if (value.type === 'replace') {
      applyWorkspaceState(record, value.value)
    } else if (value.type === 'upsert') {
      const workspace = value.workspace
      if (workspace === undefined) return
      const index = record.items.findIndex(item => item.workspaceId === workspace.workspaceId)
      if (index === -1) record.items = [...record.items, workspace]
      else record.items = record.items.map((item, itemIndex) => itemIndex === index ? workspace : item)
    } else if (value.type === 'remove') {
      record.items = record.items.filter(item => item.workspaceId !== value.workspaceId)
    } else if (value.type === 'order') {
      const byId = new Map(record.items.map(item => [item.workspaceId, item]))
      const ordered = []
      for (const id of value.workspaceIds ?? []) {
        const item = byId.get(id)
        if (item !== undefined) { ordered.push(item); byId.delete(id) }
      }
      record.items = [...ordered, ...byId.values()]
    } else if (value.type === 'archived') {
      record.archivedSessionIds = Array.isArray(value.archivedSessionIds) ? value.archivedSessionIds : []
    } else if (value.type === 'pinned') {
      record.pinnedSessionIds = Array.isArray(value.pinnedSessionIds) ? value.pinnedSessionIds : []
    }
    record.snapshot = {
      items: record.items.map(workspace => ({
        ...workspace,
        workspaceId: nativeId(record.hostId, workspace.workspaceId),
        sessionIds: workspace.sessionIds.map(id => nativeId(record.hostId, id)),
      })),
      archivedSessionIds: record.archivedSessionIds.map(id => nativeId(record.hostId, id)),
      pinnedSessionIds: record.pinnedSessionIds.map(id => nativeId(record.hostId, id)),
      state: 'idle', phase: 'ready', error: null,
    }
    for (const listener of record.listeners) listener()
    scheduleRender()
  }

  function startWorkspaceStream(hostId) {
    if (state.stopped) return
    const record = workspaceRecord(hostId)
    if (record.socket !== undefined) return
    if (record.timer !== undefined) {
      clearTimeout(record.timer)
      record.timer = undefined
    }
    let socket
    try {
      socket = new WebSocket(`${GATEWAY.replace(/^http/, 'ws')}/host/${encodeURIComponent(hostId)}/api/remote.mux`)
    } catch (error) {
      warn(`workspace socket ${hostId}: ${error.message}`)
      return
    }
    record.socket = socket
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({
          type: 'open',
          streamId: 'workspace',
          endpoint: 'workspace/follow',
          payload: { args: {} },
        }))
      } catch (error) {
        warn(`workspace open ${hostId}: ${error.message}`)
      }
    }
    socket.onmessage = event => {
      let message
      try { message = JSON.parse(event.data) } catch { return }
      if (message.type === 'item') applyWorkspaceFrame(record, message.value)
      else if (message.type === 'error') warn(`workspace stream ${hostId}: ${message.error?.message ?? 'unknown'}`)
    }
    socket.onerror = () => warn(`workspace socket error ${hostId}`)
    socket.onclose = () => {
      if (record.socket === socket) record.socket = undefined
      if (state.stopped) return
      if (!state.data.hosts.some(host => host.id === hostId)) return
      record.timer = setTimeout(() => {
        record.timer = undefined
        startWorkspaceStream(hostId)
      }, 3000)
    }
  }

  function startHostEvents(hostId) {
    if (state.stopped || state.native.patched !== true) return
    let record = state.events.get(hostId)
    if (record === undefined) {
      record = { socket: undefined, timer: undefined, clientId: undefined, pending: new Set() }
      state.events.set(hostId, record)
    }
    if (record.socket !== undefined) return
    if (record.timer !== undefined) {
      clearTimeout(record.timer)
      record.timer = undefined
    }
    let socket
    try {
      socket = new WebSocket(`${GATEWAY.replace(/^http/, 'ws')}/host/${encodeURIComponent(hostId)}/api/remote.mux`)
    } catch (error) {
      warn(`events socket ${hostId}: ${error.message}`)
      return
    }
    record.socket = socket
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({ type: 'open', streamId: 'events', endpoint: '$events', payload: { args: {} } }))
        socket.send(JSON.stringify({ type: 'open', streamId: 'control', endpoint: 'session/control', payload: { args: {} } }))
      } catch (error) {
        warn(`events open ${hostId}: ${error.message}`)
      }
    }
    socket.onmessage = event => {
      let message
      try { message = JSON.parse(event.data) } catch { return }
      if (message.type !== 'item') return
      const value = message.value
      if (message.streamId === 'control') {
        if (value.type === 'baseline') {
          record.baselines = value.value.projections
          for (const session of state.native.records.values()) {
            if (session.hostId !== hostId) continue
            session.binding.session.projections.clear()
            const baseline = record.baselines?.[session.rawId]
            if (baseline !== undefined) session.binding.session.projections.seed(baseline)
          }
        } else if (value.type === 'projection') {
          const session = state.native.records.get(nativeId(hostId, value.sessionId))
          if (session !== undefined) {
            for (const change of value.changes) session.binding.session.projections.apply(change.key, change.val, value.seq)
          }
        }
        return
      }
      if (value?.type === 'ready') {
        record.clientId = value.clientId
        log(`events ready ${hostId} client=${String(value.clientId).slice(0, 8)}`)
        return
      }
      if (value?.type === 'emit') {
        if (value.event === 'api-session/added') {
          const host = state.data.hosts.find(host => host.id === hostId)
          if (host !== undefined) {
            const summary = value.args[0]
            host.sessions = [...(host.sessions ?? []).filter(session => session.sessionId !== summary.sessionId), summary]
            ensureNativeRows()
            render()
          }
        } else if (value.event === 'api-session/activity') {
          const summary = state.data.hosts.find(host => host.id === hostId)?.sessions?.find(session => session.sessionId === value.args[0])
          if (summary !== undefined) summary.updatedAt = value.args[1]
          ensureNativeRows()
        } else if (value.event === 'api-session/status') {
          const summary = state.data.hosts.find(host => host.id === hostId)?.sessions?.find(session => session.sessionId === value.args[0])
          if (summary !== undefined) {
            summary.running = value.args[1]
            if (summary.running) summary.blank = false
          }
          const session = state.native.records.get(nativeId(hostId, value.args[0]))
          session?.binding.session.handleRunning(value.args[1])
          ensureNativeRows()
        } else if (value.event === 'api-session/error') {
          state.native.records.get(nativeId(hostId, value.args[0]))?.binding.session.handleAgentError(value.args[1])
        } else if (value.event === 'api-session/removed') {
          state.native.records.get(nativeId(hostId, value.args[0]))?.binding.session.handleRemoved()
          void load()
        } else if (['llm/models-updated', 'llm/adapters-updated', 'settings/document-updated', 'credentials/record-updated', 'credentials/reference-updated'].includes(value.event)) {
          state.native.catalogs.get(hostId)?.refresh()
        }
        return
      }
      if (value?.type === 'waterfall') {
        void handleRemoteApproval(hostId, value, record)
        return
      }
      if (value?.type === 'cancel') {
        for (const pending of record.pending) {
          if (pending.eventId === value.eventId) pending.controller.abort(new Error('remote approval cancelled'))
        }
      }
    }
    socket.onerror = () => warn(`events socket error ${hostId}`)
    socket.onclose = () => {
      if (record.socket === socket) record.socket = undefined
      for (const pending of record.pending) pending.controller.abort(new Error('events stream closed'))
      record.pending.clear()
      if (state.stopped) return
      if (!state.data.hosts.some(host => host.id === hostId)) return
      record.timer = setTimeout(() => {
        record.timer = undefined
        startHostEvents(hostId)
      }, 3000)
    }
  }

  async function handleRemoteApproval(hostId, frame, record) {
    if (state.native.ctx === undefined || state.remote === undefined) return
    if (record.clientId === undefined) return
    const rawId = frame.agentId
    if (typeof rawId !== 'string' || rawId === '') return
    const session = nativeRecord(hostId, rawId)
    const reference = retainNative(session, { source: 'gateway' })
    const target = session.binding.ctx
    const controller = new AbortController()
    const pending = { eventId: frame.eventId, controller }
    record.pending.add(pending)
    let outcome = { kind: 'next' }
    try {
      void loadNativePage(session).catch(error => warn(`native open ${session.id}: ${error.message}`))
      const result = await state.remote.events.dispatchWaterfall(target, frame, controller.signal)
      if (result?.kind === 'result') {
        outcome = { kind: 'result', value: result.value }
      } else if (result?.kind === 'next') {
        outcome = { kind: 'next' }
      }
    } catch (error) {
      if (!controller.signal.aborted) warn(`remote approval ${frame.eventId}: ${error.message}`)
      outcome = { kind: 'rejected', error: runtime.projectRemoteEventRejection(error) }
    } finally {
      record.pending.delete(pending)
    }
    if (controller.signal.aborted) { reference.release(); return }
    try {
      await callApi(hostId, '$events/result', {
        clientId: record.clientId,
        eventId: frame.eventId,
        outcome,
      })
    } catch (error) {
      warn(`approval result ${frame.eventId}: ${error.message}`)
    } finally {
      reference.release()
    }
  }

  function stopHostEvents() {
    for (const record of state.events.values()) {
      if (record.timer !== undefined) clearTimeout(record.timer)
      for (const pending of record.pending) pending.controller.abort(new Error('plugin stopped'))
      record.pending.clear()
      try { record.socket?.close() } catch {}
    }
    state.events.clear()
  }

  function refreshEventStreams(hosts) {
    const desired = new Set(hosts.map(host => host.id))
    const selected = parseNativeId(state.native.ctx?.uiWorkspace.mainReference?.sessionId)
    if (selected !== undefined && !desired.has(selected.hostId)) state.native.ctx.uiWorkspace.clearMain()
    for (const [id, record] of state.native.records) {
      if (desired.has(record.hostId)) continue
      record.binding.session.handleRemoved()
      disposeNativeRecord(record)
    }
    for (const [hostId, transport] of state.native.transports) {
      if (desired.has(hostId)) continue
      void transport.dispose()
      state.native.transports.delete(hostId)
      state.native.catalogs.delete(hostId)
    }
    for (const [hostId, record] of state.events) {
      if (desired.has(hostId)) continue
      if (record.timer !== undefined) clearTimeout(record.timer)
      for (const pending of record.pending) pending.controller.abort(new Error('host removed'))
      try { record.socket?.close() } catch {}
      state.events.delete(hostId)
    }
    for (const host of hosts) startHostEvents(host.id)
  }

  function refreshWorkspaceStreams(hosts) {
    const desired = new Set(hosts.map(host => host.id))
    for (const [hostId, record] of state.workspaces) {
      if (desired.has(hostId)) continue
      if (record.timer !== undefined) clearTimeout(record.timer)
      try { record.socket?.close() } catch {}
      state.workspaces.delete(hostId)
    }
    for (const host of hosts) startWorkspaceStream(host.id)
  }

  function stopWorkspaceStreams() {
    for (const record of state.workspaces.values()) {
      if (record.timer !== undefined) clearTimeout(record.timer)
      try { record.socket?.close() } catch {}
    }
    state.workspaces.clear()
  }

  // ---- data --------------------------------------------------------------
  async function fetchStatus() {
    const response = await fetch(`${GATEWAY}/status`, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error(`status ${response.status}`)
    return response.json()
  }

  async function fetchSessions(hostId, signal) {
    const rpcId = crypto.randomUUID()
    const response = await fetch(`${GATEWAY}/host/${encodeURIComponent(hostId)}/api/session/list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.any([AbortSignal.timeout(6000), ...(signal === undefined ? [] : [signal])]),
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method: 'session/list',
        payload: { args: { _request: {} } },
      }),
    })
    if (!response.ok) throw new Error(`api ${response.status}`)
    const body = await response.json()
    return body?.result?.ok === true ? (body.result.value?.items ?? []) : []
  }

  async function load() {
    const generation = ++state.loadGeneration
    try {
      const status = await fetchStatus()
      if (status.sshAuthenticationPending && state.dialog === undefined) openHostManager()
      const hosts = await Promise.all((status.hosts ?? []).map(async host => {
        let sessions = []
        try {
          sessions = await fetchSessions(host.id)
        } catch (error) {
          warn(`sessions ${host.id}: ${error.message}`)
        }
        return { ...host, sessions }
      }))
      if (state.stopped || generation !== state.loadGeneration) return
      state.data = { hosts }
      refreshWorkspaceStreams(hosts)
      refreshEventStreams(hosts)
      ensureNativeRows()
      render()
    } catch (error) {
      if (state.stopped || generation !== state.loadGeneration) return
      warn(`status: ${error.message}`)
      if (state.data.hosts.length === 0) {
        state.data = {
          hosts: [{ id: 'gateway', label: 'remote gateway offline', online: false, auth: 'failed', sessions: [] }],
        }
        render()
      }
    }
  }

  // ---- native conversation adapter (B2) ----------------------------------
  function nativeId(hostId, rawId) {
    return `remote:${hostId}:${rawId}`
  }

  function nativeRecord(hostId, rawId) {
    const id = nativeId(hostId, rawId)
    const existing = state.native.records.get(id)
    if (existing !== undefined) return existing
    const record = {
      hostId,
      rawId,
      id,
      retained: false,
      references: new Map(),
    }
    const transport = hostTransport(hostId)
    const face = new runtime.Session(id, transport.remote)
    const { fiber, ctx: scope } = runtime.createScope(state.native.ctx, id)
    Object.defineProperty(scope, 'remote', { value: transport.remoteFor(id), configurable: true })
    Object.defineProperty(scope, 'remoteAccess', { value: transport.accessFor(scope), configurable: true })
    face.bindScope(scope)
    record.fiber = fiber
    record.binding = { sessionId: id, session: face, eventSource: face.eventSource, ctx: scope }
    const baseline = state.events.get(hostId)?.baselines?.[rawId]
    if (baseline !== undefined) face.projections.seed(baseline)
    record.stopProjection = face.projections.subscribeAny(() => {
      ensureNativeRows()
    })
    record.retainInfo = retainObserver(id).source
    state.native.records.set(id, record)
    return record
  }

  function loadNativePage(record) {
    return record.binding.session.open()
  }

  function retainObserver(id) {
    let observer = state.native.retainObservers.get(id)
    if (observer !== undefined) return observer
    observer = { snapshot: { referenceCount: 0, retainedBy: Object.create(null) }, listeners: new Set() }
    observer.source = {
      getSnapshot: () => observer.snapshot,
      subscribe: listener => { observer.listeners.add(listener); return () => observer.listeners.delete(listener) },
    }
    state.native.retainObservers.set(id, observer)
    return observer
  }

  function disposeNativeRecord(record) {
    if (state.native.records.get(record.id) !== record) return
    state.native.records.delete(record.id)
    record.live = false
    record.stopProjection()
    record.binding.session.unbindScope()
    void record.binding.session.dispose()
    void record.fiber.dispose()
    record.references.clear()
    publishNativeRetain(record)
  }

  function hostTransport(hostId) {
    let transport = state.native.transports.get(hostId)
    if (transport === undefined) {
      transport = runtime.createHostTransport(state.native.ctx, hostId, GATEWAY, runtime, warn)
      state.native.transports.set(hostId, transport)
    }
    return transport
  }

  function publishNativeRetain(record) {
    const retainedBy = Object.create(null)
    for (const source of record.references.values()) retainedBy[source] = (retainedBy[source] ?? 0) + 1
    record.retained = (retainedBy.mainView ?? 0) > 0
    const observer = retainObserver(record.id)
    observer.snapshot = { referenceCount: record.references.size, retainedBy }
    for (const listener of observer.listeners) listener()
    ensureNativeRows()
  }

  function retainNative(record, options = {}) {
    options.signal?.throwIfAborted()
    const token = {}
    record.live = true
    record.references.set(token, options.source ?? 'plugin')
    publishNativeRetain(record)
    const released = new AbortController()
    const signal = options.signal === undefined ? released.signal : AbortSignal.any([released.signal, options.signal])
    const reference = {
      sessionId: record.id,
      get binding() {
        if (released.signal.aborted || record.live === false) throw new Error(`Session reference "${record.id}" is released`)
        return record.binding
      },
      release() {
        if (!record.references.delete(token)) return
        released.abort(new Error(`Session reference "${record.id}" is released`))
        publishNativeRetain(record)
        queueMicrotask(() => {
          if (record.references.size === 0) disposeNativeRecord(record)
        })
      },
      [Symbol.dispose]() { this.release() },
    }
    reference.ready = new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      loadNativePage(record).then(() => {
        try { signal.throwIfAborted(); resolve(reference.binding) } catch (error) { reject(error) }
      }, reject).finally(() => signal.removeEventListener('abort', abort))
    })
    void reference.ready.catch(() => {})
    return reference
  }

  function ensureNativeRows() {
    const native = state.native
    if (native.patched !== true || native.repairing) return
    const sessions = native.ctx?.sessions
    if (sessions === undefined) return
    try {
      const current = sessions.list.getSnapshot()
      const byId = { ...current.byId }
      let changed = false
      const desired = new Set()
      for (const host of state.data.hosts) {
        for (const session of host.sessions ?? []) {
          const id = nativeId(host.id, session.sessionId)
          desired.add(id)
          const record = native.records.get(id)
          if (record !== undefined) {
            record.binding.session.handleRunning(session.running === true)
            record.binding.session.handleBlank(session.blank === true)
            const projectionKey = JSON.stringify(session.projections)
            if (session.projections?.values !== undefined && projectionKey !== record.lastSummaryProjections) {
              record.lastSummaryProjections = projectionKey
              if (session.projections.kind === 'sequenced') {
                for (const [key, value] of Object.entries(session.projections.values)) record.binding.session.projections.apply(key, value, session.projections.asOfSeq)
              } else record.binding.session.projections.applyCached(session.projections.values)
            }
          }
          const title = record?.binding.session.projections.get('title') ?? session.projections?.values?.title ?? session.title
            ?? session.cwd?.split('/').filter(Boolean).at(-1) ?? session.sessionId
          const summary = {
            id,
            displayTitle: title,
            cwd: session.cwd,
            running: record?.binding.session.getSnapshot().running ?? session.running === true,
            blank: record?.binding.session.getSnapshot().blank ?? session.blank === true,
            updatedAt: session.updatedAt,
            retainedBy: record?.retainInfo.getSnapshot().retainedBy ?? {},
            projectionValues: record?.binding.session.projections.values() ?? session.projections?.values ?? {},
          }
          const existing = byId[id]
          if (existing === undefined || existing.displayTitle !== summary.displayTitle || existing.cwd !== summary.cwd || existing.updatedAt !== summary.updatedAt || existing.running !== summary.running || existing.blank !== summary.blank || JSON.stringify(existing.retainedBy) !== JSON.stringify(summary.retainedBy) || JSON.stringify(existing.projectionValues) !== JSON.stringify(summary.projectionValues)) {
            byId[id] = summary
            changed = true
          }
        }
      }
      for (const id of Object.keys(byId)) {
        if (id.startsWith('remote:') && !desired.has(id)) {
          delete byId[id]
          changed = true
        }
      }
      if (!changed) return
      const ids = [...current.ids.filter(id => byId[id] !== undefined)]
      for (const id of Object.keys(byId)) if (!ids.includes(id)) ids.push(id)
      native.repairing = true
      try {
        sessions.list.set({ ...current, ids, byId })
      } finally {
        native.repairing = false
      }
      scheduleRender()
    } catch (error) {
      warn(`native rows: ${error.message}`)
    }
  }

  function patchNativeSessions(ctx) {
    const native = state.native
    if (native.patched) return
    native.lifetime = new Lifetime()
    native.ctx = ctx
    installNativeAdapter(ctx, runtime, native, native.lifetime, {
      nativeRecord, retainNative, retainObserver, workspaceRecord, hostTransport,
      ensureNativeRows, syncSidebarSelection, connectRemoteWorkspace, createRemoteWorkspace, pickRemoteDirectory, gateway: GATEWAY,
    })
    native.patched = true
    native.lifetime.defer(ctx.uiSession.sessionStatus.subscribe(() => scheduleRender()))
    ensureNativeRows()
    log('native adapter patched')
  }

  function openNativeSession(hostId, rawId) {
    if (state.native.patched !== true) throw new Error('远程会话适配尚未启动')
    const record = nativeRecord(hostId, rawId)
    ensureNativeRows()
    state.native.ctx.uiWorkspace.openSession(record.id)
  }

  function stopNative() {
    const native = state.native
    if (native.lifetime === undefined) return
    if (parseNativeId(native.ctx.uiWorkspace.mainReference?.sessionId) !== undefined) native.ctx.uiWorkspace.clearMain()
    native.patched = false
    const sessions = native.ctx?.sessions
    try {
      native.lifetime.dispose()
    } finally {
      native.lifetime = undefined
      for (const record of [...native.records.values()]) disposeNativeRecord(record)
      for (const transport of native.transports.values()) void transport.dispose()
      native.transports.clear()
      native.records.clear()
      const current = sessions.list.getSnapshot()
      const byId = { ...current.byId }
      for (const id of Object.keys(byId)) if (parseNativeId(id) !== undefined) delete byId[id]
      sessions.list.set({ ...current, ids: current.ids.filter(id => byId[id] !== undefined), byId })
      native.catalogs.clear()
    }
  }

  // ---- remote requests ---------------------------------------------------
  async function callApi(hostId, method, args, signal) {
    const rpcId = crypto.randomUUID()
    let response
    try {response = await fetch(`${GATEWAY}/host/${encodeURIComponent(hostId)}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.any([AbortSignal.timeout(8000),...(signal ? [signal] : [])]),
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }),
    })} catch(error) {
      if (signal?.aborted) throw error
      throw new Error(error.name === 'TimeoutError' ? '远程请求超时，请检查机器连接后重试。' : '无法连接本地 DSH 服务，请刷新页面后重试。',{cause:error})
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    if (body?.result?.ok !== true) {
      const error = new Error(body?.result?.error?.message ?? 'remote error')
      error.code = body?.result?.error?.code
      throw error
    }
    return body.result.value
  }

  // ---- observer ----------------------------------------------------------
  function scheduleRender(delay = 0) {
    if (state.stopped || state.renderTimer !== undefined) return
    state.renderTimer = setTimeout(() => {
      state.renderTimer = undefined
      render()
    }, delay)
  }

  function observe() {
    state.observer?.disconnect()
    state.observer = new MutationObserver(() => {
      if (!state.section?.isConnected || !state.localHeading?.isConnected
        || state.templates.group === undefined || state.templates.session === undefined) scheduleRender(120)
    })
    const sidebar = findSidebar()
    if (sidebar !== null) state.observer.observe(sidebar, { childList: true, subtree: true })
    for (let parent = sidebar?.parentElement ?? document.body; parent !== null; parent = parent.parentElement) {
      state.observer.observe(parent, { childList: true })
    }
  }

  // ---- lifecycle ---------------------------------------------------------
  function start(ctx) {
    if (state.started) return
    const context = ctx ?? state.native.ctx
    assertCompatible(context, runtime, VERSION)
    GATEWAY = gatewayAddress(window.__DSH_REMOTE_HOSTS_CONFIG__)
    state.started = true
    state.stopped = false
    state.misses = 0
    try {
      state.native.ctx = context
      state.remote = context.remote
      patchNativeSessions(context)
      addStyle()
      log(`start version=${VERSION} gateway=${GATEWAY}`)
      void load()
      observe()
      state.timer = setInterval(() => { void load() }, 15000)
    } catch (error) {
      try { stop() } catch (cleanup) { throw new AggregateError([error, cleanup], '远程机器插件启动及清理失败') }
      throw error
    }
  }

  function stop() {
    state.stopped = true
    state.started = false
    state.loadGeneration++
    clearInterval(state.timer)
    state.timer = undefined
    clearTimeout(state.renderTimer)
    state.renderTimer = undefined
    state.observer?.disconnect()
    state.observer = undefined
    removeInjected()
    stopWorkspaceStreams()
    stopHostEvents()
    closeDialog()
    state.style?.remove()
    state.style = undefined
    stopNative()
  }

  function snapshot() {
    return {
      version: VERSION,
      mode: 'inline',
      started: state.started,
      hosts: state.data.hosts.length,
      sectionConnected: state.section?.isConnected === true,
      misses: state.misses,
      gateway: GATEWAY,
      native: state.native.patched ? { patched: true, records: state.native.records.size, routedEndpoints: state.native.routedEndpoints } : null,
    }
  }

  window.__DSH_REMOTE_HOSTS__ = { start, stop, snapshot, render, refresh: load }

  // Plugin entry. The Client loader calls apply(ctx) after mounting the bundle.
  const plugin = {
    name: 'dsh-remote-hosts',
    inject: ['sessions', 'uiWorkspace', 'remote', 'remote.session', 'fileUpload', 'typert', 'modelDirectories', 'remoteAccess', 'uiSession', 'workspaces', 'slots'],
    apply(ctx) {
      ctx.effect(() => { start(ctx); return stop }, 'remote-hosts: injection')
    },
  }
  return plugin
}

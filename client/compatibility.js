export const supportedVersion = '0.2.2-rc.1'

export function assertCompatible(ctx, runtime, version) {
  if (version !== supportedVersion) throw new Error(`远程机器插件适配 DSH ${supportedVersion}，当前版本为 ${version}`)
  const required = {
    sessions: ['binding', 'retain', 'using', 'retainInfo', 'scope', 'scopeOf', 'sessionOf', 'retainAgentScope'],
    uiWorkspace: ['openSession', 'clearMain', 'startSession', 'connectBlank'],
    fileUpload: ['upload', 'uploadImage'],
    uiSession: ['materializeAbsent', 'provide'],
    slots: ['subscribe', 'entries'],
    modelDirectories: ['directoryFor'],
    remoteAccess: ['source', 'whenResourceAccess'],
  }
  for (const [service, methods] of Object.entries(required)) {
    for (const method of methods) {
      if (typeof ctx?.[service]?.[method] !== 'function') throw new Error(`DSH ${version} 缺少兼容接口 ${service}.${method}`)
    }
  }
  for (const method of ['getSnapshot', 'subscribe', 'set']) {
    if (typeof ctx.sessions.list?.[method] !== 'function') throw new Error(`DSH 会话列表缺少 ${method}`)
  }
  for (const method of ['getSnapshot','subscribe']) {
    if (typeof ctx.uiSession.sessionStatus?.[method] !== 'function') throw new Error(`DSH 会话状态缺少 ${method}`)
  }
  if (typeof runtime.ModelDirectory !== 'function' || typeof ctx.modelDirectories.catalog?.constructor !== 'function'
    || typeof ctx.modelDirectories.catalog?.resetGeneration !== 'function') throw new Error('DSH 模型目录结构不兼容')
  if (typeof ctx.typert?.remotes?.list !== 'function') throw new Error('DSH Remote 注册接口不可用')
}

export function gatewayAddress(config) {
  const url = new URL(config?.gateway)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('宿主提供了无效的远程机器连接地址')
  }
  return url.origin
}

export const sidebarSelectors = {
  sidebar: '[class*="_sidebarCol"]',
  tree: '[role="tree"]',
  region: '[class*="_root"]',
  group: '[class*="_groupSection"]',
  session: '[data-row-key^="session:"]',
}

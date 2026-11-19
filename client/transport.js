const identityKeys = new Set(['sessionId', 'agentId', 'childSessionId', 'parentSessionId', 'workspaceId', 'beforeWorkspaceId', 'beforeSessionId'])

export function remoteIdentity(id) {
  if (typeof id !== 'string' || !id.startsWith('remote:')) return undefined
  const separator = id.indexOf(':', 7)
  if (separator < 8 || separator === id.length - 1) return undefined
  return { hostId: id.slice(7, separator), rawId: id.slice(separator + 1) }
}

export function remoteInvocationIdentity(descriptor, args) {
  for (let index = 0; index < descriptor.parameters.length; index++) {
    const parameter = descriptor.parameters[index]
    const value = args[index]
    const candidates = identityKeys.has(parameter.wire) ? [value]
      : ['request', '_request'].includes(parameter.wire) && value !== null && typeof value === 'object'
        ? [...Object.entries(value).filter(([key]) => identityKeys.has(key)).map(([, id]) => id), value.address?.sessionId]
        : []
    for (const id of candidates) {
      const parsed = remoteIdentity(id)
      if (parsed !== undefined) return parsed
    }
  }
}

function wireValue(value, hostId, key) {
  if (identityKeys.has(key) && typeof value === 'string') {
    const id = remoteIdentity(value)
    if (id === undefined) return value
    if (id.hostId !== hostId) throw new Error('不能向另一台机器发送会话操作')
    return id.rawId
  }
  if (Array.isArray(value)) return value.map(item => wireValue(item, hostId))
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, wireValue(item, hostId, name)]))
}

export function createHostTransport(ctx, hostId, baseUrl, runtime, warn) {
  const { RemoteStream, RemoteStreamMuxClient, RemoteError } = runtime
  const lifetime = new AbortController()
  const access = new runtime.ClientAccessState()
  const listeners = new Set()
  let generationValue
  let generationNumber = 0
  let reconnectTimer
  const generation = {
    getSnapshot: () => generationValue,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const publish = value => {
    generationValue = value
    for (const listener of listeners) listener()
  }
  const socketUrl = `${baseUrl.replace(/^http/, 'ws')}/host/${encodeURIComponent(hostId)}/api/remote.mux`
  const mux = new RemoteStreamMuxClient(() => {
    const socket = new WebSocket(socketUrl)
    socket.addEventListener('open', () => publish({ id: ++generationNumber, host: { home: undefined } }))
    socket.addEventListener('close', () => {
      if (lifetime.signal.aborted) return
      publish(undefined)
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => mux.reconnect(), 1000)
    })
    return socket
  }, true)
  mux.start()

  async function request(endpoint, args, signal) {
    const combined = AbortSignal.any([lifetime.signal, signal ?? AbortSignal.timeout(30000)])
    try {
      const response = await fetch(`${baseUrl}/host/${encodeURIComponent(hostId)}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: combined,
        body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: endpoint, payload: { args: wireValue(args, hostId) } }),
      })
      if (!response.ok) throw new Error(`远程请求失败：HTTP ${response.status}`)
      const body = await response.json()
      if (body.result?.ok !== true) {
        const error = body.result?.error
        return { ok: false, error: new RemoteError(error?.code ?? 'gateway/internal', error?.message ?? '远程调用失败', error?.details ?? {}) }
      }
      return body.result
    } catch (error) {
      return { ok: false, error: new RemoteError(combined.aborted ? 'gateway/cancelled' : 'gateway/internal', error.message, {}) }
    }
  }

  function invoke(endpoint, values, sessionId) {
    const descriptor = ctx.typert.remotes.get(endpoint)
    if (descriptor === undefined) throw new Error(`当前 DSH 未提供接口 ${endpoint}`)
    const projection = descriptor.scope
    const scoped = sessionId !== undefined && projection !== undefined
    const parameters = descriptor.parameters
    const expected = parameters.length - (scoped ? 1 : 0)
    const args = {}
    let index = 0
    for (const parameter of parameters) {
      const value = scoped && parameter.wire === projection.wire ? sessionId : values[index++]
      if (value !== undefined) args[parameter.wire] = value
    }
    const signal = values[expected] instanceof AbortSignal ? values[expected] : undefined
    if (descriptor.mode !== undefined) {
      const controller = new AbortController()
      const combined = AbortSignal.any([lifetime.signal, controller.signal, ...(signal === undefined ? [] : [signal])])
      const stream = mux.open(endpoint, { args: wireValue(args, hostId) }, combined)
      return {
        [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
        dispose: () => controller.abort(),
      }
    }
    return request(endpoint, args, signal)
  }

  const remotes = new Map()
  function remoteFor(sessionId) {
    const key = sessionId ?? ''
    if (remotes.has(key)) return remotes.get(key)
    const namespaces = new Map()
    const remote = new Proxy({}, {
      get(_target, namespace) {
        if (namespace === '$stream') return options => new RemoteStream({ generation }, options)
        if (namespace === '$host') return { home: generationValue?.host.home, isLoopback: false }
        if (typeof namespace !== 'string') return undefined
        if (!namespaces.has(namespace)) {
          const methods = new Map()
          namespaces.set(namespace, new Proxy({}, {
            get(_namespace, method) {
              if (typeof method !== 'string' || method === 'then') return undefined
              if (!methods.has(method)) methods.set(method, (...args) => invoke(`${namespace}/${method}`, args, sessionId))
              return methods.get(method)
            },
          }))
        }
        return namespaces.get(namespace)
      },
    })
    remotes.set(key, remote)
    return remote
  }

  const accessStream = remoteFor().$stream({
    name: `Remote access ${hostId}`,
    open: signal => remoteFor().remoteAccess.follow(signal),
    ended: () => new runtime.RemoteStreamCarrierError('Remote access stream ended'),
  })
  const accessTask = (async () => {
    try {
      for await (const item of accessStream) {
        const frame = item.value
        if (frame.type === 'baseline') { access.replace(frame); item.accept() }
        else access.update(frame)
      }
    } catch (error) {
      access.unavailable()
      if (!lifetime.signal.aborted) warn(`access ${hostId}: ${error.message}`)
    }
  })()

  return {
    hostId,
    access,
    accessFor(scope) {
      return {
        source: (kind, id, action) => access.resource(kind, remoteIdentity(id)?.rawId ?? id, action),
        whenAccess: (action, callback) => runtime.whenAllowed(scope, access.global(action), callback, `remote ${hostId} access`),
        whenResourceAccess: (kind, id, action, callback) => runtime.whenAllowed(scope, access.resource(kind, remoteIdentity(id)?.rawId ?? id, action), callback, `remote ${hostId} resource access`),
      }
    },
    remote: remoteFor(),
    remoteFor,
    request,
    stream: (endpoint, args, signal = lifetime.signal) => mux.open(endpoint, { args: wireValue(args, hostId) }, signal),
    async dispose() {
      lifetime.abort()
      clearTimeout(reconnectTimer)
      await accessStream.dispose()
      await accessTask
      await mux.close()
      listeners.clear()
      remotes.clear()
    },
  }
}

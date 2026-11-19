// Remote hosts gateway: SSH tunnels + loopback HTTP/WS proxy for remote DSH hosts.
// Pure Node, no DSH imports; the plugin entry (index.js) and the CLI bin use it.
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createSshManager } from './ssh-manager.js'
import { randomUUID } from 'node:crypto'

const DEFAULT_GATEWAY_PORT = 0

function readJsonBody(request, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    request.on('error', reject)
  })
}

// Browser Origin allowlist: the Desktop renderer and loopback web UIs only.
// Non-browser callers (no Origin) stay allowed because the listener is loopback-only.
function isAllowedOrigin(origin) {
  if (origin === undefined) return true
  if (origin === 'dsh-app://app') return true
  let url
  try { url = new URL(origin) } catch { return false }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return url.hostname === '127.0.0.1'
    || url.hostname === 'localhost'
    || url.hostname === '::1'
    || url.hostname === '[::1]'
}

function normalizeHosts(hosts) {
  return (Array.isArray(hosts) ? hosts : []).map((host, index) => ({
    id: typeof host.id === 'string' && host.id !== '' ? host.id : `host-${String(index + 1)}`,
    label: typeof host.label === 'string' && host.label !== '' ? host.label : host.id,
    sshAlias: host.sshAlias,
    remotePort: Number(host.remotePort ?? 3080),
    localPort: Number(host.localPort ?? host.remotePort ?? 3080),
    token: typeof host.token === 'string' ? host.token : undefined,
  }))
}

function validatePort(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be an integer from 1 to 65535`)
}

function validateHost(host, gatewayPort, hosts) {
  if (!/^[a-zA-Z0-9_-]+$/.test(host.id)) throw new Error('id may contain only letters, numbers, underscores and hyphens')
  if (typeof host.sshAlias !== 'string' || !/^[^\s-][^\s]*$/.test(host.sshAlias) || /[\x00-\x1f\x7f]/.test(host.sshAlias)) throw new Error('sshAlias is invalid')
  validatePort(host.remotePort, 'remotePort')
  validatePort(host.localPort, 'localPort')
  if (host.localPort === gatewayPort) throw new Error('localPort conflicts with gatewayPort')
  const conflict = hosts.find(item => item.id !== host.id && item.localPort === host.localPort)
  if (conflict !== undefined) throw new Error(`localPort ${host.localPort} is already used by ${conflict.id}`)
}

function portInUse(port) {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
  })
}

function waitPort(port, timeoutMs = 8000, signal) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (signal?.aborted) {reject(signal.reason);return}
      const socket = net.connect(port, '127.0.0.1')
      socket.once('connect', () => { socket.destroy(); resolve() })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} not ready`))
        else setTimeout(attempt, 150)
      })
    }
    attempt()
  })
}

/**
 * Create a lazy gateway over remote DSH hosts.
 * @param {{ gatewayPort?: number, hosts?: unknown[] }} config
 * @param {{ info?: Function, warn?: Function }} [logger]
 */
export function createGateway(config = {}, logger = {}) {
  const configHosts = normalizeHosts(config.hosts)
  const configHostIds = new Set(configHosts.map(host => host.id))
  const hiddenConfigHosts = new Set()
  let hosts = [...configHosts]
  const requestedPort = Number(config.gatewayPort ?? DEFAULT_GATEWAY_PORT)
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error('gatewayPort must be an integer from 0 to 65535')
  let gatewayPort = requestedPort
  for (const host of hosts) validateHost(host, gatewayPort, hosts)
  if (new Set(hosts.map(host => host.id)).size !== hosts.length) throw new Error('host ids must be unique')
  const hostsFile = typeof config.hostsFile === 'string' && config.hostsFile !== ''
    ? config.hostsFile
    : path.join(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'), 'remote-hosts.json')
  const info = typeof logger.info === 'function' ? logger.info.bind(logger) : console.log
  const warn = typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn

  const ssh = new Map() // id -> { child, online, stderr }
  const cookies = new Map() // id -> 'name=value'
  const auth = new Map() // id -> 'ok' | 'failed' | 'none'
  const authAttempts = new Map() // id -> epoch ms of last background refresh
  const stopped = { value: false }
  let server
  let started = false
  let healthTimer
  let persistence = Promise.resolve()
  let management = Promise.resolve()
  const connections = new Set()
  const sshEnvironments = new Map()
  const sshManager = createSshManager({
    directory: path.join(path.dirname(hostsFile), 'remote-hosts-runtime'),
    gatewayPort: () => gatewayPort,
    configFile: config.sshConfigFile,
    findHost: (alias, effective) => hosts.find(host => host.sshAlias === alias || host.sshAlias === `${effective.user}@${alias}` || host.label === alias),
    connectHost: async (alias, endpoint, existing, environment, signal) => {
      signal.throwIfAborted()
      const localPort = existing?.localPort ?? await availablePort()
      const host = {id:existing?.id ?? `ssh-${randomUUID()}`,label:alias,sshAlias:alias,remotePort:endpoint.port,localPort,token:endpoint.token}
      sshEnvironments.set(host.id, environment)
      const abort = () => {void stopSsh(host.id)}
      signal.addEventListener('abort',abort,{once:true})
      try {await manage(() => upsertHost(host))} finally {signal.removeEventListener('abort',abort)}
      if (signal.aborted) {await stopSsh(host.id);signal.throwIfAborted()}
      const result = publicHosts().find(item => item.id === host.id)
      if (!result?.online || result.auth !== 'ok') throw new Error(result?.error ?? '远端 DSH 认证失败')
      return result
    },
  })

  async function availablePort() {
    const probe = net.createServer()
    await new Promise((resolve,reject) => {probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve)})
    const port = probe.address().port
    await new Promise(resolve => probe.close(resolve))
    return port
  }

  function manage(operation) {
    const result = management.then(operation)
    management = result.catch(() => {})
    return result
  }

  const hostById = id => hosts.find(host => host.id === id)

  function publicHosts() {
    return hosts.map(host => ({
      id: host.id,
      label: host.label,
      sshAlias: host.sshAlias,
      remotePort: host.remotePort,
      localPort: host.localPort,
      hasToken: typeof host.token === 'string' && host.token !== '',
      online: ssh.get(host.id)?.online === true,
      auth: auth.get(host.id) ?? 'none',
      error: ssh.get(host.id)?.error,
    }))
  }

  function hiddenConfigHostList() {
    return configHosts
      .filter(host => hiddenConfigHosts.has(host.id))
      .map(host => ({
        id: host.id,
        label: host.label,
        sshAlias: host.sshAlias,
        remotePort: host.remotePort,
        localPort: host.localPort,
        hasToken: typeof host.token === 'string' && host.token !== '',
      }))
  }

  async function loadHostsFile() {
    try {
      const text = await readFile(hostsFile, 'utf8')
      const data = JSON.parse(text)
      if (!Array.isArray(data?.hosts)) return
      for (const id of Array.isArray(data?.hiddenConfigHosts) ? data.hiddenConfigHosts : []) {
        if (typeof id === 'string') hiddenConfigHosts.add(id)
      }
      hosts = hosts.filter(host => !(configHostIds.has(host.id) && hiddenConfigHosts.has(host.id)))
      for (const input of data.hosts) {
        const host = normalizeHosts([input])[0]
        if (hiddenConfigHosts.has(host.id)) continue
        validateHost(host, gatewayPort, hosts)
        const index = hosts.findIndex(item => item.id === host.id)
        if (index === -1) hosts.push(host)
        else hosts[index] = host
      }
      info(`remote-hosts: loaded ${hosts.length} host(s) from ${hostsFile}`)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  function persistHosts() {
    const contents = JSON.stringify({ hosts, hiddenConfigHosts: [...hiddenConfigHosts] }, null, 2)
    const operation = persistence.then(async () => {
      await mkdir(path.dirname(hostsFile), { recursive: true })
      const pendingFile = `${hostsFile}.pending`
      await writeFile(pendingFile, contents, { mode: 0o600 })
      await rename(pendingFile, hostsFile)
    })
    persistence = operation.catch(() => {})
    return operation
  }

  async function stopSsh(hostId) {
    const entry = ssh.get(hostId)
    if (entry !== undefined) {
      entry.stopping = true
      try { entry.child?.kill('SIGTERM') } catch { /* already gone */ }
      ssh.delete(hostId)
      await entry.exited
    }
    cookies.delete(hostId)
    auth.delete(hostId)
    authAttempts.delete(hostId)
  }

  async function upsertHost(input) {
    const id = typeof input?.id === 'string' && input.id !== '' ? input.id : `host-${Date.now().toString(36)}`
    const host = normalizeHosts([{ ...input, id }])[0]
    const existing = hostById(host.id)
    if (existing !== undefined && (typeof input?.token !== 'string' || input.token === '')) {
      host.token = existing.token
    }
    validateHost(host, gatewayPort, hosts)
    if (configHostIds.has(host.id)) hiddenConfigHosts.delete(host.id)
    if (existing !== undefined) {
      await stopSsh(host.id)
      hosts = hosts.map(item => item.id === host.id ? host : item)
    } else {
      hosts.push(host)
    }
    if (started && !stopped.value) {
      await startSsh(host)
      if (ssh.get(host.id)?.online) await exchangeToken(host)
    }
    await persistHosts()
    return status()
  }

  async function removeHost(id) {
    if (typeof id !== 'string' || id === '') throw new Error('id is required')
    const host = hostById(id)
    if (host === undefined) return status()
    if (configHostIds.has(id)) hiddenConfigHosts.add(id)
    hosts = hosts.filter(item => item.id !== id)
    await stopSsh(id)
    sshEnvironments.delete(id)
    await persistHosts()
    return status()
  }

  async function unhideHost(id) {
    if (typeof id !== 'string' || id === '') throw new Error('id is required')
    if (!configHostIds.has(id)) throw new Error('not a config host')
    hiddenConfigHosts.delete(id)
    if (hostById(id) === undefined) {
      const host = configHosts.find(item => item.id === id)
      if (host === undefined) throw new Error('unknown config host')
      hosts.push(host)
      if (started && !stopped.value) {
        await startSsh(host)
        if (ssh.get(host.id)?.online) await exchangeToken(host)
      }
    }
    await persistHosts()
    return status()
  }

  async function testHost(id) {
    if (typeof id !== 'string' || id === '') throw new Error('id is required')
    const host = hostById(id)
    if (host === undefined) throw new Error('unknown host')
    if (ssh.get(host.id)?.child === undefined) ssh.delete(host.id)
    await startSsh(host)
    if (ssh.get(host.id)?.online) await exchangeToken(host)
    return publicHosts().find(item => item.id === host.id)
  }

  async function startSsh(host) {
    if (stopped.value || ssh.has(host.id)) return
    const entry = { child: undefined, online: false, stderr: '', stopping: false }
    ssh.set(host.id, entry)
    const open = await portInUse(host.localPort)
    if (stopped.value || ssh.get(host.id) !== entry) return
    if (open) {
      entry.error = `localPort ${host.localPort} is already occupied`
      warn(`[ssh:${host.id}] ${entry.error}`)
      return
    }
    await spawnSsh(host, entry)
  }

  async function spawnSsh(host, entry) {
    const environment = sshEnvironments.get(host.id)
    const args = [
      ...(config.sshConfigFile ? ['-F', config.sshConfigFile] : []),
      ...(!environment ? ['-o', 'BatchMode=yes'] : []),
      '-o', 'ExitOnForwardFailure=yes',
      '-N',
      '-L', `127.0.0.1:${host.localPort}:127.0.0.1:${host.remotePort}`,
      host.sshAlias,
    ]
    const child = spawn('ssh', args, { env:environment ?? process.env, stdio: ['ignore', 'ignore', 'pipe'] })
    const waiting = new AbortController()
    entry.child = child
    entry.exited = new Promise(resolve => child.once('close', resolve))
    child.on('error', error => { entry.error = error.message; warn(`[ssh:${host.id}] ${error.message}`) })
    child.stderr.on('data', chunk => {
      entry.stderr = (entry.stderr + chunk.toString()).slice(-4000)
    })
    child.on('exit', (code, signal) => {
      entry.online = false
      waiting.abort(new Error(entry.stderr.trim() || 'SSH 连接已结束'))
      if (ssh.get(host.id) === entry) {entry.child=undefined;entry.error=entry.stderr.trim() || `SSH 已退出（${code}）`}
      info(`[ssh:${host.id}] exited code=${String(code)} signal=${String(signal)}`)
      if (!entry.stopping && entry.connected && !stopped.value && hostById(host.id) !== undefined) {
        setTimeout(() => {if(ssh.get(host.id)===entry) ssh.delete(host.id);void startSsh(host)}, 1000)
      }
    })
    await Promise.race([
      waitPort(host.localPort, environment ? 180000 : 15000,waiting.signal),
      entry.exited.then(() => {throw new Error(entry.stderr.trim() || 'SSH 连接已结束')}),
    ])
      .then(() => {
        if (ssh.get(host.id) !== entry) return
        if (child.exitCode !== null || child.signalCode !== null) return
        entry.online = true
        entry.connected = true
        info(`[ssh:${host.id}] 127.0.0.1:${host.localPort} -> ${host.remotePort}`)
        if (cookies.get(host.id) === undefined && auth.get(host.id) !== 'ok') void refreshAuth(host)
      })
      .catch(error => {
        if (ssh.get(host.id) === entry) warn(`[ssh:${host.id}] ${error.message}`)
        entry.error = error.message
        entry.stopping = true
        child.kill('SIGTERM')
      })
  }

  async function exchangeToken(host) {
    if (stopped.value || hostById(host.id) !== host || ssh.get(host.id)?.online !== true) return false
    if (host.token === undefined || host.token === '') {
      cookies.delete(host.id)
      auth.set(host.id, 'none')
      return false
    }
    try {
      const url = `http://127.0.0.1:${host.localPort}/?token=${encodeURIComponent(host.token)}`
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
      if (stopped.value || hostById(host.id) !== host || ssh.get(host.id)?.online !== true) return false
      const setCookies = response.headers.getSetCookie?.() ?? []
      const cookie = setCookies.map(value => value.split(';')[0]).find(value => value.startsWith('dsh-auth-'))
      if (cookie === undefined) {
        cookies.delete(host.id)
        auth.set(host.id, 'failed')
        warn(`[auth:${host.id}] no dsh-auth cookie (status ${response.status})`)
        return false
      }
      cookies.set(host.id, cookie)
      auth.set(host.id, 'ok')
      info(`[auth:${host.id}] cookie acquired (status ${response.status})`)
      return true
    } catch (error) {
      if (stopped.value || hostById(host.id) !== host) return false
      cookies.delete(host.id)
      auth.set(host.id, 'failed')
      warn(`[auth:${host.id}] ${error.message}`)
      return false
    }
  }

  async function refreshAuth(host) {
    const now = Date.now()
    const last = authAttempts.get(host.id) ?? 0
    if (now - last < 5000) return false
    authAttempts.set(host.id, now)
    return exchangeToken(host)
  }

  function cors(request, response) {
    const origin = request.headers.origin
    if (origin !== undefined && isAllowedOrigin(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('access-control-allow-credentials', 'true')
      response.setHeader('vary', 'Origin')
    }
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
    response.setHeader(
      'access-control-allow-headers',
      request.headers['access-control-request-headers'] ?? 'content-type',
    )
  }

  function status() {
    return {
      running: started && !stopped.value,
      gatewayPort,
      hostsFile,
      hosts: publicHosts(),
      hiddenHosts: hiddenConfigHostList(),
      sshAuthenticationPending:sshManager.needsAuth(),
    }
  }

  function proxyHttp(request, response, host, rest) {
    if (ssh.get(host.id)?.online !== true) {
      cors(request, response)
      response.writeHead(503, { 'content-type': 'text/plain' })
      response.end(`remote tunnel unavailable: ${host.id}`)
      return
    }
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks)
      const send = retry => {
        const headers = {
          host: `127.0.0.1:${host.localPort}`,
          'content-type': request.headers['content-type'] ?? 'application/json',
          'content-length': String(body.byteLength),
        }
        const cookie = cookies.get(host.id)
        if (cookie !== undefined) headers.cookie = cookie
        const upstream = http.request(
          { host: '127.0.0.1', port: host.localPort, path: rest, method: request.method, headers },
          upstreamResponse => {
            const status = upstreamResponse.statusCode ?? 502
            if (retry && (status === 401 || status === 403) && host.token !== undefined) {
              upstreamResponse.resume()
              exchangeToken(host).then(authenticated => {
                if (authenticated) {
                  send(false)
                  return
                }
                cors(request, response)
                response.writeHead(502, { 'content-type': 'text/plain' })
                response.end(`remote auth failed: ${host.id}`)
              }).catch(error => {
                cors(request, response)
                response.writeHead(502, { 'content-type': 'text/plain' })
                response.end(`remote auth failed: ${error.message}`)
              })
              return
            }
            cors(request, response)
            response.writeHead(status, {
              'content-type': upstreamResponse.headers['content-type'] ?? 'application/json',
            })
            upstreamResponse.pipe(response)
          },
        )
        upstream.on('error', error => {
          cors(request, response)
          response.writeHead(502, { 'content-type': 'text/plain' })
          response.end(`gateway upstream error: ${error.message}`)
        })
        upstream.end(body)
      }
      send(true)
    })
  }

  function proxyUpgrade(request, socket, head, host, rest) {
    if (rest !== '/api/remote.mux' || ssh.get(host.id)?.online !== true) {
      socket.destroy()
      return
    }
    const upstream = net.connect(host.localPort, '127.0.0.1')
    upstream.once('connect', () => {
      const lines = [
        `GET ${rest} HTTP/1.1`,
        `Host: 127.0.0.1:${host.localPort}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${request.headers['sec-websocket-key'] ?? ''}`,
        `Sec-WebSocket-Version: ${request.headers['sec-websocket-version'] ?? '13'}`,
      ]
      const protocol = request.headers['sec-websocket-protocol']
      if (protocol !== undefined) lines.push(`Sec-WebSocket-Protocol: ${protocol}`)
      const cookie = cookies.get(host.id)
      if (cookie !== undefined) lines.push(`Cookie: ${cookie}`)
      upstream.write(lines.join('\r\n') + '\r\n\r\n')
      if (head.length > 0) upstream.write(head)
      upstream.pipe(socket)
      socket.pipe(upstream)
    })
    upstream.on('error', () => socket.destroy())
    upstream.on('close', () => {
      try { socket.destroy() } catch { /* already gone */ }
    })
    upstream.on('end', () => {
      try { socket.end() } catch { /* already gone */ }
    })
    socket.on('error', () => upstream.destroy())
    socket.on('close', () => upstream.destroy())
  }

  function createServer() {
    const srv = http.createServer((request, response) => {
      if (!isAllowedOrigin(request.headers.origin)) {
        const body = 'origin not allowed'
        response.writeHead(403, { 'content-type': 'text/plain', 'content-length': String(Buffer.byteLength(body)) })
        response.end(body)
        return
      }
      if (request.method === 'OPTIONS') {
        cors(request, response)
        response.writeHead(204, { 'content-length': '0' })
        response.end()
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/manage/ssh' || url.pathname === '/manage/ssh/askpass') {
        cors(request, response)
        const respond = (code, body) => {response.writeHead(code,{'content-type':'application/json'});response.end(JSON.stringify(body))}
        if (url.pathname.endsWith('/askpass')) {
          if (request.method !== 'POST') {respond(405,{ok:false});return}
          readJsonBody(request).then(body => sshManager.askpass(request.headers.authorization?.replace(/^Bearer /,''),body))
            .then(answer => {response.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});response.end(answer)},error => respond(400,{ok:false,error:error.message}))
          return
        }
        if (request.method === 'GET') sshManager.list().then(value => respond(200,{ok:true,...value}),error => respond(400,{ok:false,error:error.message}))
        else if (request.method === 'POST') readJsonBody(request).then(body => sshManager.action(body)).then(value => respond(200,{ok:true,...value}),error => respond(400,{ok:false,error:error.message}))
        else respond(405,{ok:false,error:'method not allowed'})
        return
      }
      if (url.pathname === '/status') {
        cors(request, response)
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(status()))
        return
      }
      if (url.pathname === '/manage/hosts') {
        cors(request, response)
        if (request.method === 'GET') {
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok: true, running: status().running, hosts: publicHosts(), hiddenHosts: hiddenConfigHostList() }))
          return
        }
        if (request.method === 'POST') {
          readJsonBody(request).then(async body => {
            try {
              let gateway
              let host
              if (body.action === 'upsert') gateway = await manage(() => upsertHost(body.host ?? {}))
              else if (body.action === 'remove') gateway = await manage(() => removeHost(body.id))
              else if (body.action === 'test') host = await manage(() => testHost(body.id))
              else if (body.action === 'unhide') gateway = await manage(() => unhideHost(body.id))
              else throw new Error('unknown action')
              cors(request, response)
              response.writeHead(200, { 'content-type': 'application/json' })
              response.end(JSON.stringify(host === undefined ? { ok: true, gateway } : { ok: true, host }))
            } catch (error) {
              cors(request, response)
              response.writeHead(400, { 'content-type': 'application/json' })
              response.end(JSON.stringify({ ok: false, error: error.message }))
            }
          }, error => {
            cors(request, response)
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, error: error.message }))
          })
          return
        }
        response.writeHead(405, { 'content-type': 'text/plain' })
        response.end('method not allowed')
        return
      }
      const match = /^\/host\/([^/]+)(\/.*)$/.exec(url.pathname)
      if (match === null) {
        cors(request, response)
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('not found')
        return
      }
      const host = hostById(decodeURIComponent(match[1]))
      if (host === undefined) {
        cors(request, response)
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('unknown host')
        return
      }
      proxyHttp(request, response, host, match[2] + url.search)
    })
    srv.on('connection', socket => {
      connections.add(socket)
      socket.on('close', () => connections.delete(socket))
    })
    srv.on('upgrade', (request, socket, head) => {
      if (!isAllowedOrigin(request.headers.origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        socket.destroy()
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const match = /^\/host\/([^/]+)(\/.*)$/.exec(url.pathname)
      const host = match === null ? undefined : hostById(decodeURIComponent(match[1]))
      if (host === undefined) {
        socket.destroy()
        return
      }
      proxyUpgrade(request, socket, head, host, match[2])
    })
    return srv
  }

  async function start() {
    if (started || stopped.value) return status()
    started = true
    try {
      await loadHostsFile()
      if (stopped.value) throw new Error('Gateway 启动已取消')
      await sshManager.start()
      if (stopped.value) throw new Error('Gateway 启动已取消')
      do {
        server = createServer()
        await new Promise((resolve, reject) => {
          server.once('error', reject)
          server.listen(requestedPort, '127.0.0.1', resolve)
        })
        gatewayPort = server.address().port
        if (requestedPort !== 0 || !hosts.some(host => host.localPort === gatewayPort)) break
        await new Promise(resolve => server.close(resolve))
      } while (!stopped.value)
      if (stopped.value) throw new Error('Gateway 启动已取消')
      info(`remote-hosts: gateway on 127.0.0.1:${gatewayPort}`)
      healthTimer = setInterval(() => {
        if (stopped.value) return
        for (const host of hosts) {
          if (ssh.get(host.id)?.error && ssh.get(host.id)?.child === undefined) ssh.delete(host.id)
          if (!ssh.has(host.id)) void startSsh(host)
          else if (ssh.get(host.id)?.online && auth.get(host.id) !== 'ok') void refreshAuth(host)
        }
      }, 30000)
      await Promise.all(hosts.map(async host => {
        await startSsh(host)
        if (ssh.get(host.id)?.online) await exchangeToken(host)
      }))
      if (stopped.value) throw new Error('Gateway 启动已取消')
      return status()
    } catch (error) {
      stop()
      throw error
    }
  }

  function stop() {
    if (stopped.value) return
    stopped.value = true
    clearInterval(healthTimer)
    sshManager.stop()
    sshEnvironments.clear()
    healthTimer = undefined
    for (const entry of ssh.values()) {
      entry.stopping = true
      try { entry.child?.kill('SIGTERM') } catch { /* already gone */ }
    }
    ssh.clear()
    for (const socket of connections) socket.destroy()
    connections.clear()
    if (server !== undefined) {
      server.close()
      server = undefined
    }
  }

  return {
    start, stop, status, listHosts: publicHosts,
    upsertHost: input => manage(() => upsertHost(input)),
    removeHost: id => manage(() => removeHost(id)),
    testHost: id => manage(() => testHost(id)),
    unhideHost: id => manage(() => unhideHost(id)),
  }
}

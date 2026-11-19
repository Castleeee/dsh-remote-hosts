import { randomUUID, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { quote } from 'shell-quote'
import { addSshHost, defaultConfigFile, effectiveSshConfig, listSshHosts } from './ssh-config.js'

export function createSshManager({ directory, gatewayPort, configFile = defaultConfigFile, findHost, connectHost }) {
  const operations = new Map()
  const launcher = path.join(directory, 'ssh-askpass')
  const challenges = new Map()
  let stopped = false

  async function start() {
    await mkdir(directory, {recursive:true,mode:0o700})
    await writeFile(launcher, `#!/bin/sh\nexec ${quote([process.execPath, fileURLToPath(new URL('askpass.mjs', import.meta.url))])} "$@"\n`, {mode:0o700})
    await chmod(launcher,0o700)
  }

  function snapshot(operation) {
    return { id:operation.id, alias:operation.alias, phase:operation.phase, error:operation.error, hostId:operation.hostId, installation:operation.installation && { id:operation.installation.id, ...operation.installation.plan }, prompt:operation.prompt && { id:operation.prompt.id, text:operation.prompt.text, secret:operation.prompt.secret } }
  }

  function environment(operation) {
    const port = typeof gatewayPort === 'function' ? gatewayPort() : gatewayPort
    return {...process.env,SSH_ASKPASS:launcher,SSH_ASKPASS_REQUIRE:'force',DISPLAY:process.env.DISPLAY || 'dsh:0',DSH_SSH_GATEWAY:`http://127.0.0.1:${port}`,DSH_SSH_CHALLENGE:operation.secret}
  }

  function run(operation, args, input, controlled = false) {
    operation.controller.signal.throwIfAborted()
    return new Promise((resolve,reject) => {
      const child = spawn('ssh', [...(configFile === defaultConfigFile ? [] : ['-F',configFile]),...args], {env:environment(operation),stdio:['pipe','pipe','pipe'],signal:controlled ? undefined : operation.controller.signal})
      let cancelDeadline
      const abort = () => {
        child.stdin.end('cancel\n')
        cancelDeadline = setTimeout(() => child.kill('SIGTERM'),5000)
      }
      if (controlled) operation.controller.signal.addEventListener('abort',abort,{once:true})
      let stdout = ''
      let stderr = ''
      child.stdout.on('data',chunk => {stdout += chunk; if (stdout.length > 1024*1024) child.kill()})
      child.stderr.on('data',chunk => {stderr = (stderr+chunk).slice(-6000)})
      child.on('error',reject)
      child.on('close',code => {clearTimeout(cancelDeadline);operation.controller.signal.removeEventListener('abort',abort);child.stdin.destroy();code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `SSH 已退出（${code}）`))})
      child.stdin.on('error',error => {if (error.code !== 'EPIPE') reject(error)})
      if (!controlled) child.stdin.end(input)
    })
  }

  function begin(alias) {
    if (stopped) throw new Error('SSH 管理已停止')
    if ([...operations.values()].some(op => op.alias === alias && !['ready','failed','cancelled'].includes(op.phase))) throw new Error('此机器正在连接')
    const operation = {id:randomUUID(),secret:randomBytes(32).toString('hex'),alias,phase:'connecting',controller:new AbortController()}
    operations.set(operation.id,operation)
    const deadline=setTimeout(() => {operation.timedOut=true;operation.controller.abort()},10*60*1000)
    void (async () => {
      const effective = await effectiveSshConfig(alias,configFile)
      const existing = findHost(alias,effective)
      let endpoint = existing && {port:existing.remotePort,token:existing.token}
      if (!endpoint?.token) {
        operation.phase = 'checking'
        const script = await readFile(new URL('bootstrap.sh',import.meta.url),'utf8')
        const plan = JSON.parse((await run(operation,[alias,'sh -s -- probe'],script)).trim())
        if (typeof plan.installNode !== 'boolean' || typeof plan.installDsh !== 'boolean' || typeof plan.dshVersion !== 'string' || typeof plan.nodeVersion !== 'string') throw new Error('远端返回了无效的安装计划')
        if (plan.installNode || plan.installDsh) {
          operation.phase = 'awaiting-installation'
          const accepted = await confirmInstallation(operation, plan)
          if (!accepted) { operation.installationRejected = true; throw new Error('已拒绝安装，未连接') }
        }
        operation.controller.signal.throwIfAborted()
        operation.background = true
        operation.phase = plan.installNode || plan.installDsh ? 'installing' : 'preparing'
        const runner = await readFile(new URL('bootstrap-runner.sh',import.meta.url),'utf8')
        const command = quote(['sh','-c',runner,'sh',`${script}\n`, 'prepare',String(plan.installNode),String(plan.installDsh)])
        endpoint = JSON.parse((await run(operation,[alias,command],undefined,true)).trim())
        if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535 || typeof endpoint.token !== 'string' || !endpoint.token) throw new Error('远端 DSH 返回了无效的连接信息')
      }
      operation.phase = 'connecting'
      const host = await connectHost(alias,endpoint,existing,environment(operation),operation.controller.signal)
      operation.hostId = host.id
      operation.phase = 'ready'
    })().catch(error => {operation.error = operation.timedOut ? 'SSH 连接准备超时' : operation.controller.signal.aborted ? operation.cancelMessage || '连接已取消' : error.message;operation.phase = operation.controller.signal.aborted || operation.installationRejected ? 'cancelled' : 'failed'}).finally(() => {
      clearTimeout(deadline)
      if (operation.prompt) {operation.prompt.reject(new Error('连接已结束'));challenges.delete(operation.prompt.id);operation.prompt = undefined}
      // 密码只存在于单次认证请求中。
      if (operation.phase !== 'ready') operation.secret = undefined
    })
    return snapshot(operation)
  }

  function confirmInstallation(operation, plan) {
    operation.controller.signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const abort = () => settle(undefined, new Error('连接已取消'))
      const settle = (accepted, error) => {
        operation.controller.signal.removeEventListener('abort', abort)
        operation.installation = undefined
        error ? reject(error) : resolve(accepted)
      }
      operation.installation = { id:randomUUID(), plan, resolve:accepted => settle(accepted) }
      operation.controller.signal.addEventListener('abort', abort, { once:true })
    })
  }

  async function askpass(secret, body) {
    const operation = [...operations.values()].find(item => item.secret === secret && secret)
    if (!operation || operation.controller.signal.aborted) throw new Error('认证请求已失效')
    if (operation.prompt) throw new Error('正在等待上一个认证请求')
    return new Promise((resolve,reject) => {
      const prompt = {id:randomUUID(),text:String(body.prompt ?? 'SSH 认证'),secret:body.hint !== 'confirm',resolve,reject}
      operation.prompt = prompt
      challenges.set(prompt.id,operation)
      const timeout = setTimeout(() => settle(undefined,new Error('SSH 认证超时')),180000)
      const abort = () => settle(undefined,new Error('连接已取消'))
      const settle = (answer,error) => {
        clearTimeout(timeout)
        operation.controller.signal.removeEventListener('abort',abort)
        challenges.delete(prompt.id)
        if (operation.prompt === prompt) operation.prompt = undefined
        error ? reject(error) : resolve(answer)
      }
      prompt.resolve = answer => settle(answer)
      prompt.reject = error => settle(undefined,error)
      operation.controller.signal.addEventListener('abort',abort,{once:true})
    })
  }

  async function action(body) {
    if (body.action === 'add') return {alias:await addSshHost(body.command,configFile)}
    if (body.action === 'connect') {
      const hosts = await listSshHosts(configFile)
      if (!hosts.some(host => host.alias === body.alias)) throw new Error('SSH 配置中没有此机器，请刷新列表')
      return {operation:begin(body.alias)}
    }
    if (body.action === 'answer') {
      const operation = challenges.get(body.id)
      if (!operation?.prompt || typeof body.answer !== 'string' || /[\r\n\x00]/.test(body.answer)) throw new Error('认证请求已失效或输入无效')
      operation.prompt.resolve(body.answer)
      return {}
    }
    if (body.action === 'confirm-installation') {
      const operation = operations.get(body.id)
      if (!operation?.installation || operation.installation.id !== body.confirmationId || operation.controller.signal.aborted || typeof body.accepted !== 'boolean') throw new Error('安装确认已失效或输入无效')
      operation.background = body.accepted
      operation.installation.resolve(body.accepted)
      return {}
    }
    if (body.action === 'cancel' || body.action === 'dismiss') {
      const operation = operations.get(body.id)
      if (!operation) throw new Error('连接请求不存在')
      if (['ready','failed','cancelled','cancelling'].includes(operation.phase) || body.action === 'dismiss' && operation.background) return {}
      const installing = operation.phase === 'installing'
      operation.cancelMessage = installing ? '安装已取消' : '连接已取消'
      operation.controller.abort()
      operation.phase='cancelling'
      operation.error=operation.cancelMessage
      return {}
    }
    throw new Error('未知 SSH 操作')
  }

  return {
    start, action, askpass,
    needsAuth: () => [...operations.values()].some(operation => operation.prompt),
    list: async () => ({configFile,hosts:await listSshHosts(configFile),operations:[...operations.values()].slice(-30).map(snapshot)}),
    stop: () => {stopped=true;for (const op of operations.values()) op.controller.abort()},
  }
}

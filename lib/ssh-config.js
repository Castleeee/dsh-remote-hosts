import SSHConfig from 'ssh-config'
import { parse } from 'shell-quote'
import { glob, mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

const execute = promisify(execFile)
export const defaultConfigFile = path.join(os.homedir(), '.ssh/config')
const values = value => Array.isArray(value) ? value.map(item => item.val) : [value]
const literalHost = value => typeof value === 'string' && value !== '' && !/[\s*?!\x00-\x1f\x7f]/.test(value) && !value.startsWith('-')

export async function listSshHosts(configFile = defaultConfigFile) {
  const hosts = new Map()
  const seen = new Set()
  async function visit(file) {
    file = path.resolve(file)
    if (seen.has(file)) return
    seen.add(file)
    let contents
    try { contents = await readFile(file, 'utf8') } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    async function entries(config) {
      for (const line of config) {
        if (line.param?.toLowerCase() === 'host') {
          for (const alias of values(line.value)) if (literalHost(alias) && !hosts.has(alias)) hosts.set(alias, { alias, configFile: file })
        }
        if (line.param?.toLowerCase() === 'include') {
          for (let pattern of values(line.value)) {
            if (pattern.startsWith('~/')) pattern = path.join(os.homedir(), pattern.slice(2))
            if (!path.isAbsolute(pattern)) pattern = path.join(os.homedir(), '.ssh', pattern)
            const files = []
            for await (const included of glob(pattern)) files.push(included)
            for (const included of files.sort()) await visit(included)
          }
        }
        if (line.config) await entries(line.config)
      }
    }
    await entries(SSHConfig.parse(contents))
  }
  await visit(configFile)
  return [...hosts.values()]
}

export async function effectiveSshConfig(alias, configFile = defaultConfigFile) {
  if (!literalHost(alias)) throw new Error('SSH 主机名称无效')
  const { stdout } = await execute('ssh', [...(configFile === defaultConfigFile ? [] : ['-F', configFile]), '-G', alias], { timeout: 15000, maxBuffer: 1024 * 1024 })
  const computed = SSHConfig.parse(stdout).compute(alias, { ignoreCase: true, matchExec: false })
  return { hostname: computed.hostname, user: computed.user, port: Number(computed.port), serverAliveInterval: Number(computed.serveraliveinterval), serverAliveCountMax: Number(computed.serveralivecountmax) }
}

export function parseSshCommand(command) {
  if (typeof command !== 'string' || /[\r\n\x00]/.test(command)) throw new Error('请输入一条 SSH 连接命令')
  const tokens = parse(command, name => { throw new Error(`请直接填写 ${name} 的值`) })
  if (tokens.some(token => typeof token !== 'string')) throw new Error('SSH 命令不能包含管道、重定向或其他命令')
  if (tokens[0] === 'ssh') tokens.shift()
  const config = {}
  let destination
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const option = token.slice(0, 2)
    if (['-p', '-l', '-i', '-J', '-o'].includes(option)) {
      const value = token.slice(2) || tokens[++i]
      if (!value || /[\r\n\x00]/.test(value)) throw new Error(`${option} 缺少有效参数`)
      if (option === '-p') { if (!/^\d+$/.test(value) || +value < 1 || +value > 65535) throw new Error('SSH 端口无效'); config.Port = value }
      if (option === '-l') config.User = value
      if (option === '-i') config.IdentityFile = value
      if (option === '-J') config.ProxyJump = value
      if (option === '-o') {
        const parsed = SSHConfig.parse(value)
        const line = parsed.find(item => item.param)
        const allowed = ['serveraliveinterval', 'serveralivecountmax', 'connecttimeout', 'identitiesonly', 'identityfile', 'proxyjump', 'preferredauthentications']
        if (parsed.filter(item => item.param).length !== 1 || !allowed.includes(line?.param.toLowerCase())) throw new Error('请在 SSH 配置文件中设置此选项')
        config[line.param] = values(line.value).join(' ')
      }
    } else {
      if (token.startsWith('-') || destination) throw new Error('请输入 ssh user@host -p 22，不能包含远端命令')
      destination = token
    }
  }
  if (!literalHost(destination)) throw new Error('SSH 主机名称无效')
  const at = destination.lastIndexOf('@')
  const hostname = at < 0 ? destination : destination.slice(at + 1)
  if (!hostname || (at === 0)) throw new Error('请输入有效的 user@host')
  if (at > 0 && !config.User) config.User = destination.slice(0, at)
  return { destination, hostname, config }
}

export async function addSshHost(command, configFile = defaultConfigFile) {
  const input = parseSshCommand(command)
  const hosts = await listSshHosts(configFile)
  if (Object.keys(input.config).length === 0 && hosts.some(host => host.alias === input.hostname)) return input.hostname
  if (hosts.some(host => host.alias === input.hostname)) {
    const effective = await effectiveSshConfig(input.hostname, configFile)
    if ((!input.config.User || input.config.User === effective.user) && (!input.config.Port || +input.config.Port === effective.port) && Object.keys(input.config).every(key => ['User', 'Port'].includes(key))) return input.hostname
  }
  const base = input.hostname.replace(/[^a-zA-Z0-9._-]/g, '-')
  let alias = base
  let index = 2
  while (hosts.some(host => host.alias === alias)) alias = `${base}-${index++}`
  await mkdir(path.dirname(configFile), { recursive: true, mode: 0o700 })
  let target=configFile
  let original=''
  let mode=0o600
  try {target=await realpath(configFile);original=await readFile(target,'utf8');mode=(await stat(target)).mode & 0o777} catch(error) {if(error.code!=='ENOENT') throw error}
  const lock=await open(`${target}.dsh-lock`,'wx',0o600)
  const pending=`${target}.dsh-pending`
  try {
    const config=SSHConfig.parse(original)
    config.prepend({Host:alias,HostName:input.hostname,...input.config},true)
    await writeFile(pending,SSHConfig.stringify(config),{flag:'wx',mode})
    let current=''
    try {current=await readFile(target,'utf8')} catch(error) {if(error.code!=='ENOENT') throw error}
    if(current!==original) throw new Error('SSH 配置已被其他程序修改，请刷新后重试')
    await rename(pending,target)
  } finally {await lock.close();await rm(`${target}.dsh-lock`,{force:true});await rm(pending,{force:true})}
  return alias
}

set -eu
umask 077
base="$HOME/.local/share/dsh-remote-hosts"
dsh_version=0.2.2-rc.1
node_version=24.20.0
inspection_node=
inspectable_node() {
  "$1" -e 'process.exit(Number(process.versions.node.split(".")[0])>=20 ? 0 : 1)' >/dev/null 2>&1
}
if command -v node >/dev/null 2>&1 && inspectable_node "$(command -v node)"; then inspection_node=$(command -v node); fi
usable_node() {
  command -v node >/dev/null 2>&1 && node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>24 || major===24 && minor>=9 ? 0 : 1)' >/dev/null 2>&1
}
if ! usable_node; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin "$base/node/bin"; do
    if [ -z "$inspection_node" ] && [ -x "$candidate/node" ] && inspectable_node "$candidate/node"; then inspection_node="$candidate/node"; fi
    if [ -x "$candidate/node" ] && PATH="$candidate:$PATH" usable_node; then
      PATH="$candidate:$PATH"; export PATH; break
    fi
  done
fi
# 非交互 SSH 不加载用户的 Node.js 初始化脚本。
if ! usable_node && [ -d /proc ]; then
  for process_id in $(ps -u "$(id -u)" -o pid=); do
    candidate=$(readlink "/proc/$process_id/exe" 2>/dev/null || true)
    case "$candidate" in
      */node) candidate=${candidate%/node}
        if [ -z "$inspection_node" ] && inspectable_node "$candidate/node"; then inspection_node="$candidate/node"; fi
        if PATH="$candidate:$PATH" usable_node; then PATH="$candidate:$PATH"; export PATH; break; fi ;;
    esac
  done
fi
install_node=false
if ! usable_node; then install_node=true; fi
if [ "$install_node" = false ]; then inspection_node=$(command -v node); fi
export DSH_REMOTE_BASE="$base"
discovery='{"installDsh":true,"runningDsh":false}'
if [ -n "$inspection_node" ]; then
  discovery=$("$inspection_node" --input-type=module <<'DSH_DISCOVER'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
const missing = error => ['ENOENT','EACCES','EPERM','ESRCH','ENOTDIR'].includes(error.code)
async function optional(operation) {
  try { return await operation() } catch (error) { if (!missing(error)) throw error }
}
async function installation(executable) {
  const file = await optional(() => realpath(executable))
  if (!file) return
  let directory = path.dirname(file)
  while (directory !== path.dirname(directory)) {
    const contents = await optional(() => readFile(path.join(directory,'package.json'),'utf8'))
    if (contents) {
      const manifest = JSON.parse(contents)
      if (manifest.name === '@deepseek-ai/dsh') return {executable:file,version:manifest.version}
    }
    directory = path.dirname(directory)
  }
}
const active = []
const installs = []
const processes = await optional(() => readdir('/proc')) ?? []
for (const pid of processes.filter(name => /^\d+$/.test(name))) {
  const directory = `/proc/${pid}`
  const owner = await optional(() => stat(directory))
  if (owner?.uid !== process.getuid()) continue
  const raw = await optional(() => readFile(`${directory}/cmdline`,'utf8'))
  const args = raw?.split('\0').filter(Boolean)
  if (!args || !/^(node|nodejs)$/.test(path.basename(args[0] ?? '')) || !args[1]) continue
  if (!/(?:^|\/)(?:dsh|bin\.js)$/.test(args[1])) continue
  const environment = await optional(() => readFile(`${directory}/environ`,'utf8'))
  const values = Object.fromEntries((environment ?? '').split('\0').filter(Boolean).map(entry => {const index=entry.indexOf('=');return [entry.slice(0,index),entry.slice(index+1)]}))
  if (values.HOME !== process.env.HOME) continue
  const cwd = await optional(() => realpath(`${directory}/cwd`))
  if (!cwd) continue
  const app = await installation(path.resolve(cwd,args[1]))
  if (!app) continue
  const home = path.resolve(cwd,values.DSH_HOME || path.join(values.HOME,'.dsh'))
  installs.push({...app,home})
  const options = args.slice(2)
  if (options[0] !== 'web' && !(options[0] === '--profile' && options[1] === 'web')) continue
  const index = options.indexOf('--port')
  const port = Number(index >= 0 ? options[index+1] : options.find(value => value.startsWith('--port='))?.slice(7))
  active.push({...app,home,pid:Number(pid),port:Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined})
}
const candidates = process.env.PATH.split(path.delimiter).map(directory => path.join(directory,'dsh'))
candidates.push(path.join(process.env.DSH_REMOTE_BASE,'app/node_modules/.bin/dsh'))
for (const executable of candidates) {
  const app = await installation(executable)
  if (app && !installs.some(value => value.executable === app.executable)) installs.push({...app,home:process.env.DSH_HOME || path.join(process.env.HOME,'.dsh')})
}
const selected = active.length ? active : installs.slice(0,1)
for (const app of selected) {
  if (!['0.2.2-rc.1','0.2.2-rc.3'].includes(app.version)) throw new Error(`远端已有 DSH ${app.version}，插件支持 0.2.2-rc.1、0.2.2-rc.3；请使用兼容版本。`)
}
async function authenticated(endpoint) {
  if (!Number.isInteger(endpoint?.port) || endpoint.port < 1 || endpoint.port > 65535 || typeof endpoint.token !== 'string') return false
  if (!active.some(service => service.port === endpoint.port)) return false
  try {
    const response = await fetch(`http://127.0.0.1:${endpoint.port}/?token=${encodeURIComponent(endpoint.token)}`,{redirect:'manual',signal:AbortSignal.timeout(3000)})
    await response.body?.cancel()
    return response.headers.getSetCookie().some(cookie => cookie.startsWith('dsh-auth-'))
  } catch (error) { if (error.name !== 'TimeoutError' && !error.cause?.code?.startsWith('ECONN')) throw error; return false }
}
let endpoint
const state = await optional(() => readFile(path.join(process.env.DSH_REMOTE_BASE,'server.json'),'utf8'))
if (state) {
  const saved = JSON.parse(state)
  if (await authenticated(saved)) endpoint = {port:saved.port,token:saved.token}
}
for (const service of active.length === 1 ? active : []) {
  if (endpoint) break
  const log = await optional(() => realpath(`/proc/${service.pid}/fd/1`))
  if (!log) continue
  const info = await optional(() => stat(log))
  if (!info?.isFile() || info.size > 4*1024*1024) continue
  const contents = await optional(() => readFile(log,'utf8'))
  for (const match of (contents ?? '').matchAll(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/\?token=([\w-]+)/g)) {
    const found = {port:Number(match[1]),token:match[2]}
    if (await authenticated(found)) {endpoint=found;break}
  }
}
console.log(JSON.stringify({installDsh:!selected.length,runningDsh:Boolean(active.length),services:active,runtime:selected[0],nodeExecutable:process.execPath,endpoint}))
DSH_DISCOVER
  )
fi
install_dsh=true
case "$discovery" in *'"installDsh":false'*) install_dsh=false ;; esac
case "$discovery" in *'"runningDsh":true'*) install_node=false ;; esac
export DSH_REMOTE_DISCOVERY="$discovery"
if [ "$install_dsh" = true ] && [ "$install_node" = false ] && ! command -v npm >/dev/null 2>&1; then
  echo '已有 Node.js，但没有 npm；请为该运行环境安装 npm 后重新连接。' >&2; exit 1
fi
if [ "${1:-prepare}" = probe ]; then
  existing_node=null
  if [ -n "$inspection_node" ]; then existing_node=$("$inspection_node" -p 'JSON.stringify(process.versions.node)'); fi
  printf '{"dshVersion":"%s","nodeVersion":"%s","installDsh":%s,"installNode":%s,"existingNode":%s,"discovery":%s}\n' "$dsh_version" "$node_version" "$install_dsh" "$install_node" "$existing_node" "$discovery"
  exit 0
fi
case "$discovery" in *'"runningDsh":true'*)
  "$inspection_node" -e 'const result=JSON.parse(process.env.DSH_REMOTE_DISCOVERY);if(result.endpoint)console.log(JSON.stringify(result.endpoint));else {console.error("远端已有运行中的 DSH，请使用该服务的认证 URL 连接。");process.exit(1)}'
  exit 0 ;;
esac
if [ "${1:-prepare}" != prepare ]; then echo '未知远端准备操作' >&2; exit 1; fi
if { [ "$install_node" = true ] && [ "${2:-false}" != true ]; } || { [ "$install_dsh" = true ] && [ "${3:-false}" != true ]; }; then
  echo '远端需要安装 DSH 或运行环境，请重新连接并确认安装。' >&2
  exit 1
fi
mkdir -p "$base"
stage="$base/install-$$"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage"
if [ "$install_node" = true ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) platform=linux-x64 ;;
    Linux-aarch64) platform=linux-arm64 ;;
    *) echo '此机器需要预先安装 Node.js ≥24.9.0 和 npm。' >&2; exit 1 ;;
  esac
  mkdir -p "$stage/download"
  cd "$stage/download"
  curl -fsSLO "https://nodejs.org/dist/v$node_version/SHASUMS256.txt"
  archive=$(awk -v suffix="-$platform.tar.xz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix {print $2; exit}' SHASUMS256.txt)
  test -n "$archive"
  curl -fsSLO "https://nodejs.org/dist/v$node_version/$archive"
  awk -v archive="$archive" '$2==archive { print }' SHASUMS256.txt | sha256sum -c - >&2
  mkdir -p "$stage/node"
  tar -xJf "$archive" --strip-components=1 -C "$stage/node"
  rm "$archive" SHASUMS256.txt
  if [ -e "$base/node" ]; then mv "$base/node" "$stage/previous-node"; fi
  mv "$stage/node" "$base/node"
  PATH="$base/node/bin:$PATH"; export PATH
fi
if [ "$install_dsh" = true ]; then
  npm install --prefix "$stage/app" --no-audit --no-fund "@deepseek-ai/dsh@$dsh_version" >&2
  if [ -e "$base/app" ]; then mv "$base/app" "$stage/previous-app"; fi
  mv "$stage/app" "$base/app"
fi
cd "$base"
node --input-type=module <<'DSH_NODE'
import { readFile, writeFile } from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import { spawn } from 'node:child_process'
import net from 'node:net'
const base = process.env.DSH_REMOTE_BASE
const runtime = JSON.parse(process.env.DSH_REMOTE_DISCOVERY).runtime
const log = `${base}/server.log`
const stateFile = `${base}/server.json`
let existing
try { existing = JSON.parse(await readFile(stateFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (existing) {
  try {
    const response = await fetch(`http://127.0.0.1:${existing.port}/?token=${encodeURIComponent(existing.token)}`, {redirect:'manual',signal:AbortSignal.timeout(3000)})
    if (response.headers.getSetCookie().some(cookie => cookie.startsWith('dsh-auth-'))) { console.log(JSON.stringify(existing)); process.exit(0) }
  } catch (error) { if (error.name !== 'TimeoutError' && !error.cause?.code?.startsWith('ECONN')) throw error }
}
const probe = net.createServer()
await new Promise((resolve,reject) => {probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve)})
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const descriptor = openSync(log,'w',0o600)
const child = spawn(process.execPath, [runtime?.executable ?? `${base}/app/node_modules/.bin/dsh`,'--profile','web','--no-open','--port',String(port)], {detached:true,stdio:['ignore',descriptor,descriptor],env:{...process.env,DSH_HOME:runtime?.home ?? process.env.DSH_HOME ?? `${process.env.HOME}/.dsh`}})
closeSync(descriptor)
child.on('error', error => { console.error(error.message);process.exit(1) })
child.unref()
const deadline = Date.now()+90000
while (Date.now()<deadline) {
  const contents = await readFile(log,'utf8')
  const match = contents.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/\?token=([\w-]+)/)
  if (match) {
    const result = {port,token:match[1]}
    await writeFile(stateFile,JSON.stringify(result),{mode:0o600})
    console.log(JSON.stringify(result));process.exit(0)
  }
  await new Promise(resolve => setTimeout(resolve,250))
}
throw new Error('远端 DSH 启动超时，请检查 ~/.local/share/dsh-remote-hosts/server.log')
DSH_NODE

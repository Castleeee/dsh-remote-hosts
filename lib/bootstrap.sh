set -eu
umask 077
base="$HOME/.local/share/dsh-remote-hosts"
dsh_version=0.2.2-rc.1
node_version=24.20.0
install_dsh=false
if [ ! -x "$base/app/node_modules/.bin/dsh" ]; then install_dsh=true; fi
usable_node() {
  command -v node >/dev/null 2>&1 && node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>24 || major===24 && minor>=9 ? 0 : 1)' >/dev/null 2>&1 && { [ "$install_dsh" = false ] || command -v npm >/dev/null 2>&1; }
}
if ! usable_node; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin "$base/node/bin"; do
    if [ -x "$candidate/node" ] && PATH="$candidate:$PATH" usable_node; then
      PATH="$candidate:$PATH"; export PATH; break
    fi
  done
fi
install_node=false
if ! usable_node; then install_node=true; fi
if [ "${1:-prepare}" = probe ]; then
  existing_node=null
  if command -v node >/dev/null 2>&1; then existing_node=$(node -p 'JSON.stringify(process.versions.node)'); fi
  printf '{"dshVersion":"%s","nodeVersion":"%s","installDsh":%s,"installNode":%s,"existingNode":%s}\n' "$dsh_version" "$node_version" "$install_dsh" "$install_node" "$existing_node"
  exit 0
fi
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
export DSH_REMOTE_BASE="$base"
node --input-type=module <<'DSH_NODE'
import { readFile, writeFile } from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import { spawn } from 'node:child_process'
import net from 'node:net'
const base = process.env.DSH_REMOTE_BASE
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
const child = spawn(`${base}/app/node_modules/.bin/dsh`, ['--profile','web','--no-open','--port',String(port)], {detached:true,stdio:['ignore',descriptor,descriptor],env:{...process.env,DSH_HOME:`${process.env.HOME}/.dsh`}})
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

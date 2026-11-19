import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supportedVersion } from '../client/compatibility.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const directory = path.join(root, 'dist-pack')
await mkdir(directory, { recursive: true })
const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8' }))
assert.equal(packed.name, manifest.name)
assert.equal(packed.version, manifest.version)
const files = new Set(packed.files.map(file => file.path))
for (const required of ['lib/index.js', 'lib/bootstrap.sh', 'lib/bootstrap-runner.sh', 'client/client.js', 'client/slot-adapter.js', 'cordis.patch.yml', 'LICENSE', 'package.json']) {
  assert(files.has(required), `发布包缺少 ${required}`)
}
for (const file of files) {
  assert(!file.startsWith('.verification/') && !file.startsWith('node_modules/') && !file.startsWith('test/'), `发布包包含开发文件 ${file}`)
  assert(!/(^|\/)(config\.local\.json|remote-hosts\.json|\.env(?:\..*)?)$/.test(file), `发布包包含本地配置 ${file}`)
}
const asset = packed.filename
const tag = `v${manifest.version}`
const repository = process.env.GITHUB_REPOSITORY ?? 'Castleeee/dsh-remote-hosts'
const commit = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const checksum = createHash('sha256').update(await readFile(path.join(directory, asset))).digest('hex')
await writeFile(path.join(directory, 'SHA256SUMS'), `${checksum}  ${asset}\n`)
const url = `https://github.com/${repository}/releases/download/${tag}/${asset}`
await writeFile(path.join(directory, 'RELEASE_NOTES.md'), [
  `构建提交：\`${commit}\`。`, '',
  `适配 DSH **${supportedVersion}**，本地 Node.js **≥24.9.0**，需要系统 OpenSSH。`, '',
  '在 DSH 插件管理界面添加以下安装地址，安装完成后重启目标 profile：', '',
  '```text', url, '```', '',
  '也可以下载 tgz 文件，在插件管理界面安装本地文件。Desktop profile 由桌面应用管理。', '',
  '安装包包含构建后的客户端及 Host 插件，包管理器会安装运行依赖。机器配置、SSH 密码和测试日志不包含在安装包内。', '',
  '连接远端前检查环境；缺少 DSH 或 Node.js 时展示安装内容和版本，经确认后执行。', '',
  '每次推送 master 会重新发布当前 package.json 版本；同版本的 Release 和安装地址会更新至该次提交。',
  '目前主要在独立 Web lab 验收，Desktop 和仍待验证的行为见仓库 PROGRESS.md 与 ROADMAP.md。', '',
  'SHA256SUMS 提供安装包的 SHA-256 校验值。', '',
].join('\n'))
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\nasset=${asset}\n`)
console.log(JSON.stringify({ tag, asset, files: files.size, sha256: checksum, url }))

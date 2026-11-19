import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import { supportedVersion } from './client/compatibility.js'

const require = createRequire(import.meta.url)
const internal = (name, file) => {
  const manifest = require(`${name}/package.json`)
  if (manifest.version !== supportedVersion) throw new Error(`${name} 需要版本 ${supportedVersion}，当前为 ${manifest.version}`)
  return path.join(path.dirname(require.resolve(`${name}/package.json`)), 'lib/types', file)
}

await build({
  entryPoints: ['client/entry.js'],
  outfile: 'client/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-api-session-controller/client', '@deepseek-ai/dsh-client-ui-model-selection/client', '@deepseek-ai/dsh-client-ui-primitives', 'react', 'react-dom/client'],
  alias: {
    '@deepseek-ai/dsh-api-gateway/client': internal('@deepseek-ai/dsh-api-gateway', 'client/index.js'),
    'dsh-official-session': internal('@deepseek-ai/dsh-api-session-controller', 'client/sessions/session.js'),
    'dsh-official-stream': internal('@deepseek-ai/dsh-api-gateway', 'client/remote-stream.js'),
    'dsh-official-mux': internal('@deepseek-ai/dsh-api-gateway', 'client/stream-client.js'),
    'dsh-official-access': internal('@deepseek-ai/dsh-api-remote-access', 'client/state.js'),
    'dsh-official-when-allowed': internal('@deepseek-ai/dsh-api-remote-access', 'client/when-allowed.js'),
  },
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-remote-hosts",factory:(require)=>{const module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports.default;}});' },
  legalComments: 'eof',
})

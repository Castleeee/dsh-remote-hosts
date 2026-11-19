import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises'

test('bootstrap inspects the real runtime and rejects unapproved installation before writing', async t => {
  const root = new URL('../.verification/', import.meta.url)
  await mkdir(root, { recursive:true })
  const directory = await mkdtemp(new URL('bootstrap-consent-', root))
  t.after(() => rm(directory, { recursive:true,force:true }))
  const source = await readFile(new URL('../lib/bootstrap.sh', import.meta.url), 'utf8')
  function run(args) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-s','--',...args], { env:{ ...process.env,HOME:directory },stdio:['pipe','pipe','pipe'] })
      let stdout = '', stderr = ''
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => resolve({code,stdout,stderr}))
      child.stdin.end(source)
    })
  }
  const probe = await run(['probe'])
  assert.equal(probe.code, 0, probe.stderr)
  const plan = JSON.parse(probe.stdout)
  assert.equal(plan.existingNode, process.versions.node)
  assert.equal(plan.installNode, false)
  assert.equal(plan.installDsh, true)
  assert.deepEqual(await readdir(directory), [])
  const denied = await run(['prepare','false','false'])
  assert.equal(denied.code, 1)
  assert.match(denied.stderr, /重新连接并确认安装/)
  assert.deepEqual(await readdir(directory), [])
})

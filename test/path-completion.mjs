import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { quote } from 'shell-quote'
import { openLab } from './support/browser.mjs'

const execute = promisify(execFile)
const base = `/root/dsh-test/path-completion-${randomBytes(4).toString('hex')}`
const sshAlias = process.env.DSH_TEST_SSH_ALIAS ?? 'root@jack-dirty-linux'
const ssh = args => execute('ssh',['-p','22','-o','BatchMode=yes',sshAlias,quote(args)])
const {browser,page,errors} = await openLab(process.env.DSH_LAB_URL)
const gateway = await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.snapshot().gateway)
let createdId
const failures = []
const directoryRequests = []
page.on('request',request => {
  if (request.method() === 'POST' && request.url().endsWith('/api/directoryPicker/list')) directoryRequests.push(request.postDataJSON().payload.args.path)
})
page.on('requestfailed',request => failures.push({url:new URL(request.url()).pathname,error:request.failure()?.errorText}))
try {
  await ssh(['mkdir','-p',`${base}/alpha/child`,`${base}/beta space`,`${base}/中文目录`,`${base}/.hidden-dir`])
  await ssh(['touch',`${base}/ordinary-file`])
  await ssh(['ln','-s',`${base}/alpha`,`${base}/linked-directory`])
  const open = async () => {
    await page.locator('[data-dsh-remote-row="host"][data-host-id="jack"]').getByRole('button',{name:'新建远程工作区'}).click()
    await page.getByRole('dialog',{name:'新建远程工作区',exact:true}).waitFor()
  }
  await open()
  const dialog = page.getByRole('dialog',{name:'新建远程工作区',exact:true})
  const input = dialog.getByRole('combobox',{name:'远程路径'})
  const options = dialog.getByRole('option')
  await input.fill(`${base}/`)
  await dialog.getByRole('option',{name:'alpha/',exact:true}).waitFor()
  assert.deepEqual(await options.allTextContents(),['alpha/','beta space/','linked-directory/','中文目录/'])
  assert.equal(await input.getAttribute('aria-expanded'),'true')
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="新建远程工作区"]')
    const viewport = dialog.querySelector('[data-dsh-remote-hosts="pathViewport"]')
    const input = dialog.querySelector('input')
    const submit = dialog.querySelector('button[type="submit"]')
    window.pathGeometry = []
    const record = () => {
      if (!window.pathRecording) return
      window.pathGeometry.push([dialog.getBoundingClientRect().y,dialog.getBoundingClientRect().height,input.getBoundingClientRect().y,submit.getBoundingClientRect().y,viewport.getBoundingClientRect().height])
      requestAnimationFrame(record)
    }
    window.pathRecording = true
    record()
  })
  for (let visit=0;visit<2;visit++) {
    await dialog.getByRole('option',{name:'alpha/',exact:true}).click()
    await dialog.getByRole('option',{name:'child/',exact:true}).waitFor()
    await dialog.getByRole('option',{name:'child/',exact:true}).click()
    await dialog.getByRole('status').filter({hasText:'没有匹配的目录'}).waitFor()
    await input.fill(`${base}/`)
    await dialog.getByRole('option',{name:'alpha/',exact:true}).waitFor()
    await page.waitForFunction(() => document.querySelector('[data-dsh-remote-hosts="pathViewport"]').getAttribute('aria-busy') === 'false')
  }
  const geometry = await page.evaluate(() => {window.pathRecording=false;return window.pathGeometry})
  assert(geometry.length > 2)
  for (const frame of geometry) assert.deepEqual(frame,geometry[0],'Dialog, path field and action buttons must remain stationary throughout directory navigation')
  assert.equal(directoryRequests.filter(path=>path===base).length,1)
  assert.equal(directoryRequests.filter(path=>path===`${base}/alpha`).length,1)
  assert.equal(directoryRequests.filter(path=>path===`${base}/alpha/child`).length,1)
  console.log('PASS: continuous browser animation frames show stable dialog, input, directory area and action positions across populated and empty directories; revisiting directories reuses actual cached listings')
  await input.fill(`${base}/a`)
  await page.waitForFunction(() => document.querySelectorAll('[data-dsh-remote-hosts="pathSuggestions"] [role="option"]').length === 1)
  await input.press('ArrowDown')
  assert.equal(await dialog.getByRole('option',{name:'alpha/'}).getAttribute('aria-selected'),'true')
  await input.press('Enter')
  assert.equal(await input.inputValue(),`${base}/alpha/`)
  await dialog.getByRole('option',{name:'child/'}).waitFor()
  assert.equal(await dialog.isVisible(),true)
  await input.press('Escape')
  assert.equal(await dialog.isVisible(),true)
  assert.equal(await input.getAttribute('aria-expanded'),'false')
  await input.fill(`${base}/.`)
  await dialog.getByRole('option',{name:'.hidden-dir/'}).waitFor()
  await input.fill(`${base}/中文`)
  await dialog.getByRole('option',{name:'中文目录/'}).click()
  assert.equal(await input.inputValue(),`${base}/中文目录/`)
  await input.fill(`${base}/linked`)
  await dialog.getByRole('option',{name:'linked-directory/'}).waitFor()
  await input.press('Tab')
  assert.equal(await input.inputValue(),`${base}/linked-directory/`)
  await input.fill(`${base}/does-not-exist/`)
  await dialog.getByRole('status').filter({hasText:'远端目录不存在或没有读取权限'}).waitFor()
  await input.fill('')
  await dialog.getByRole('button',{name:'创建工作区',exact:true}).click()
  await dialog.locator('[data-dsh-remote-hosts="dialogError"]').filter({hasText:'路径不能为空'}).waitFor()
  console.log('PASS: native remote directory API supplies directories and symlinks, filters files and hidden entries, supports Chinese paths, keyboard selection and missing-directory/empty-path errors')

  await input.fill(`~/dsh-test/${base.split('/').at(-1)}/beta space`)
  const creation = page.waitForResponse(response => response.url().endsWith('/api/workspace/create'))
  await dialog.getByRole('button',{name:'创建工作区',exact:true}).click()
  const response = await creation
  const result = (await response.json()).result
  if (result.ok && result.value.created) createdId=result.value.workspace.workspaceId
  assert.equal(response.status(),200)
  assert.equal(result.ok,true,result.error?.message)
  assert.equal(result.value.created,true)
  assert.equal(result.value.workspace.path,`${base}/beta space`)
  await dialog.waitFor({state:'detached'})
  await page.locator(`[data-dsh-remote-row="workspace"][data-workspace-key="ws:${createdId}"]`).waitFor({state:'attached'})
  console.log('PASS: entering ~/ expands the remote home and creates a real remote workspace over a directory containing spaces, then updates the native sidebar')

  await open()
  await input.fill(`${base}/alpha/`)
  await input.fill(`${base}/bet`)
  await dialog.getByRole('option',{name:'beta space/'}).waitFor()
  assert.deepEqual(await options.allTextContents(),['beta space/'])
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  await dialog.waitFor({state:'detached'})
  assert.equal(await dialog.count(),0)
  assert.deepEqual(errors,[])
  assert(!failures.some(failure => !failure.error?.includes('ERR_ABORTED')),JSON.stringify(failures))
  console.log('PASS: rapid edits retain current suggestions; closing disposes the picker without browser errors')
} finally {
  if (createdId) {
    const method='workspace/delete'
    const response=await fetch(`${gateway}/host/jack/api/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:{args:{request:{workspaceId:createdId}}}})})
    assert.equal((await response.json()).result.ok,true)
  }
  await browser.close()
  await ssh(['rm','-rf',base])
}

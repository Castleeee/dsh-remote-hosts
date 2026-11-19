import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { openLab } from './support/browser.mjs'
const configFile = path.join(os.homedir(),'.ssh/config')
const before=await readFile(configFile,'utf8')
const {browser,page,errors}=await openLab(process.env.DSH_LAB_URL)
try {
  const onboarding=page.getByRole('dialog').filter({hasText:'开始使用'})
  await page.locator('[data-dsh-remote-row="host"]').first().waitFor()
  await page.addLocatorHandler(onboarding,async()=>{await onboarding.getByRole('button',{name:'关闭',exact:true}).click()})
  await page.getByRole('button',{name:'机器管理',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'远程机器管理'})
  await dialog.locator('[data-ssh-alias="jack-dirty-linux"]').waitFor()
  assert.equal(await dialog.getByRole('textbox').count(),1)
  assert.equal(await dialog.locator('input[type="password"]').count(),0)
  await dialog.getByRole('textbox',{name:'SSH 连接命令'}).fill('ssh root@jack-dirty-linux -p 22')
  await dialog.getByRole('button',{name:'添加新机器',exact:true}).click()
  await dialog.locator('[role="status"]').filter({hasText:'已连接 jack-dirty-linux'}).waitFor({timeout:90000})
  assert.equal(await readFile(configFile,'utf8'),before)
  const status=await page.evaluate(async()=> (await (await fetch(`${window.__DSH_REMOTE_HOSTS__.snapshot().gateway}/status`)).json()).hosts)
  const jack=status.find(host=>host.id==='jack')
  assert.equal(jack.sshAlias,'jack-dirty-linux')
  assert.equal(jack.auth,'ok')
  assert.equal(jack.online,true)
  await dialog.getByRole('button',{name:'关闭机器管理'}).click()
  assert.equal(await dialog.count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS: shared config UI, SSH command input, native OpenSSH connection and no credential form')
} finally {await browser.close()}

import assert from 'node:assert/strict'
import { openLab } from './support/browser.mjs'

assert(process.env.DSH_LAB_URL, 'Set DSH_LAB_URL to the authenticated lab URL')
const { browser, page, errors } = await openLab(process.env.DSH_LAB_URL)
const hostId = process.env.DSH_TEST_HOST ?? 'jack'
const host = page.locator(`[data-dsh-remote-row="host"][data-host-id="${hostId}"]`)
const workspace = page.locator(`[data-dsh-remote-row="workspace"][data-host-id="${hostId}"]`).first()
const sessions = page.locator(`[data-dsh-remote-row="session"][data-host-id="${hostId}"]`)
try {
  await host.waitFor()
  await page.locator('[data-dsh-remote-hosts="localHeading"]').waitFor()
  assert.equal(await page.locator('[data-dsh-remote-hosts="localHeading"]').innerText(), '本机')
  assert.equal(await workspace.isVisible(), false)
  assert.equal(await sessions.first().isVisible(), false)
  if (process.env.DSH_TEST_DISMISS_ONBOARDING === '1') {
    const onboarding=page.getByRole('dialog').filter({hasText:'开始使用'})
    await page.addLocatorHandler(onboarding,async()=>{await onboarding.getByRole('button',{name:'关闭',exact:true}).click()})
  }
  await host.click()
  assert.equal(await host.getAttribute('aria-expanded'), 'true')
  assert.equal(await workspace.isVisible(), true)
  assert.equal(await sessions.first().isVisible(), false)
  await workspace.click()
  assert.equal(await workspace.getAttribute('aria-expanded'), 'true')
  assert.equal(await sessions.first().isVisible(), true)
  assert.equal(await sessions.locator('[class*="_selected"]').count(), 0)
  assert.equal(await sessions.and(page.locator('[class*="_selected"]')).count(), 0)

  const geometry = await page.evaluate(() => {
    const local = [...document.querySelectorAll('[data-row-key^="session:"]')].find(row => !row.closest('[data-dsh-remote-hosts]') && getComputedStyle(row).display !== 'none')
    const remote = document.querySelector('[data-dsh-remote-row="session"]')
    const workspace = document.querySelector('[data-dsh-remote-row="workspace"]')
    const title = workspace.querySelector('[class*="_title"]')
    const count = workspace.querySelector('[data-dsh-remote-hosts="count"]')
    const center = element => { const rect = element.getBoundingClientRect(); return rect.y + rect.height / 2 }
      const metrics = row => ({ height: row.getBoundingClientRect().height, titleX: row.querySelector('[class*="_title"]').getBoundingClientRect().x, font: getComputedStyle(row.querySelector('[class*="_title"]')).fontSize, radius: getComputedStyle(row).borderRadius, background: getComputedStyle(row).backgroundColor })
      const localWorkspace = [...document.querySelectorAll('[data-row-key^="workspace:"]')].find(row => !row.closest('[data-dsh-remote-hosts]'))
    return {
      local: metrics(local), remote: metrics(remote),
      workspaceHeight: workspace.getBoundingClientRect().height,
      countAligned: Math.abs(center(title) - center(count)) <= 1,
      overflow: workspace.scrollWidth > workspace.clientWidth,
      closedFolderAvailable: document.getElementById('dsw-icon-folder-close-regular') !== null,
      workspaceTitleX: title.getBoundingClientRect().x,
      localWorkspaceTitleX: localWorkspace.querySelector('[class*="_title"]').getBoundingClientRect().x,
      workspaceFont: getComputedStyle(title).fontSize,
      localWorkspaceFont: getComputedStyle(localWorkspace.querySelector('[class*="_title"]')).fontSize,
      separatorWidths: ['divider', 'manageBar'].map(mark => getComputedStyle(document.querySelector(`[data-dsh-remote-hosts="${mark}"]`)).borderTopWidth),
    }
  })
  console.log('native sidebar layout', JSON.stringify(geometry))
  assert.equal(geometry.remote.height, geometry.local.height)
  assert.equal(geometry.remote.font, geometry.local.font)
  assert.equal(geometry.remote.titleX, geometry.local.titleX)
  assert.equal(geometry.remote.radius, geometry.local.radius)
  assert.equal(geometry.workspaceTitleX, geometry.localWorkspaceTitleX)
  assert.equal(geometry.workspaceFont, geometry.localWorkspaceFont)
  assert.equal(geometry.workspaceHeight, 34)
  assert.equal(geometry.countAligned, true)
  assert.equal(geometry.overflow, false)
  assert.equal(geometry.closedFolderAvailable, true)
  assert.equal(geometry.remote.background, 'rgba(0, 0, 0, 0)')
  assert.deepEqual(geometry.separatorWidths, ['0px', '0px'])

  const firstId = await sessions.first().getAttribute('data-session-id')
  await sessions.first().click()
  await page.waitForFunction(({ hostId, firstId }) => window.verificationCtx.uiWorkspace.selection.getSnapshot().sessionId === `remote:${hostId}:${firstId}`, { hostId, firstId })
  assert.equal(await sessions.first().getAttribute('aria-selected'), 'true')
  assert.equal(await sessions.and(page.locator('[aria-selected="true"]')).count(), 1)
  await sessions.nth(1).click()
  assert.equal(await sessions.first().getAttribute('aria-selected'), 'false')
  assert.equal(await sessions.nth(1).getAttribute('aria-selected'), 'true')
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.render())
  assert.equal(await host.getAttribute('aria-expanded'), 'true')
  assert.equal(await workspace.getAttribute('aria-expanded'), 'true')
  assert.equal(await sessions.nth(1).isVisible(), true)
  assert.equal(await sessions.nth(1).getAttribute('aria-selected'), 'true')
  await host.click()
  assert.equal(await workspace.isVisible(), false)
  assert.equal(await sessions.nth(1).isVisible(), false)
  await host.click()
  assert.equal(await workspace.isVisible(), true)
  assert.equal(await sessions.nth(1).isVisible(), true)
  await workspace.click()
  assert.equal(await sessions.first().isVisible(), false)
  assert.equal(await workspace.getAttribute('aria-expanded'), 'false')
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.render())
  assert.equal(await workspace.getAttribute('aria-expanded'), 'false')
  assert.equal(await sessions.first().isVisible(), false)
  const localWorkspace = page.locator('[data-row-key^="workspace:"]').first()
  await localWorkspace.hover()
  await localWorkspace.locator('[class*="_rowActions"] button').last().click()
  console.log('local workspace create clicked')
  await page.waitForFunction(() => {const id=window.verificationCtx.uiWorkspace.selection.getSnapshot().sessionId;return id && !id.startsWith('remote:')})
  const localId = await page.evaluate(async () => {
    const ctx=window.verificationCtx
    const id=ctx.uiWorkspace.selection.getSnapshot().sessionId
    const ref=ctx.sessions.retain(id,{source:'sidebar-verification'})
    await ref.ready
    window.localVerificationReference=ref
    const result=await ref.binding.session.prompt([{type:'text',text:'本机会话切换验证，请只回复 LOCAL_SESSION_OK。'}],'queue')
    if (!result.ok) throw new Error(result.error.message)
    return id
  })
  console.log('local prompt submitted',localId)
  await page.getByText('本机会话切换验证，请只回复 LOCAL_SESSION_OK。',{exact:true}).first().waitFor()
  await page.waitForFunction(id => !window.verificationCtx.sessions.list.getSnapshot().byId[id]?.blank,localId)
  if (await host.getAttribute('aria-expanded') === 'false') await host.click()
  if (await workspace.getAttribute('aria-expanded') === 'false') await workspace.click()
  await sessions.first().click()
  await page.waitForFunction(() => window.verificationCtx.uiWorkspace.selection.getSnapshot().sessionId?.startsWith('remote:'))
  const localRow=page.locator(`[data-row-key="session:${localId}"]`)
  const onboarding=page.getByRole('dialog').filter({hasText:'开始使用'})
  if (await onboarding.count()) await onboarding.getByRole('button',{name:'关闭',exact:true}).click()
  await localRow.click()
  await page.waitForFunction(id => window.verificationCtx.uiWorkspace.selection.getSnapshot().sessionId === id,localId)
  await page.getByText('本机会话切换验证，请只回复 LOCAL_SESSION_OK。',{exact:true}).first().waitFor()
  assert.equal(await sessions.and(page.locator('[aria-selected="true"]')).count(), 0)
  assert.equal(await page.locator('[data-row-key^="session:remote:"]').count(),0)
  await page.evaluate(async()=>{await window.localVerificationReference.binding.session.cancel()})
  await page.waitForFunction(()=>window.localVerificationReference.binding.session.getSnapshot().running===false)
  await page.evaluate(() => window.localVerificationReference.release())
  await page.evaluate(async id => {
    const result=await window.verificationCtx.get('remote.workspace').archiveSession({sessionId:id})
    if(!result.ok) throw new Error(result.error.message)
  },localId)
  await page.evaluate(() => window.__DSH_REMOTE_HOSTS__.stop())
  assert.equal(await page.locator('[data-dsh-remote-hosts="localHeading"]').count(), 0)
  assert.equal(await page.locator('[data-dsh-remote-hosts="section"]').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: native row geometry, inline counts, local/SSH separation, folding, selection, refresh and cleanup')
} finally { await browser.close() }

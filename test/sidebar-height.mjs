import assert from 'node:assert/strict'
import {openLab} from './support/browser.mjs'

const {browser,page,errors}=await openLab(process.env.DSH_LAB_URL)
const measure=()=>page.evaluate(()=>{
  const list=document.querySelector('[role="tree"]')
  const manager=document.querySelector('[data-dsh-remote-hosts="manageBar"]')
  const rows=[...list.querySelectorAll('[data-row-key]')].filter(row=>row.getClientRects().length)
  const bottom=Math.max(...rows.map(row=>row.getBoundingClientRect().bottom))
  const scroller=manager.parentElement.parentElement
  return {gap:manager.getBoundingClientRect().top-bottom,listHeight:list.getBoundingClientRect().height,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,scrollTop:scroller.scrollTop,overflow:getComputedStyle(scroller).overflowY,listOverflow:getComputedStyle(list).overflowY}
})
try {
  const onboarding=page.getByRole('dialog').filter({hasText:'开始使用'})
  await page.addLocatorHandler(onboarding,async()=>{await onboarding.getByRole('button',{name:'关闭',exact:true}).click()})
  const host=page.locator('[data-dsh-remote-row="host"]').first()
  await host.waitFor()
  const fade=page.locator('[class*="_treeBody"]:has(>[data-dsh-remote-hosts="section"]) > [class*="_fade"]')
  assert.equal(await fade.evaluate(node=>getComputedStyle(node).display),'none')
  await page.setViewportSize({width:1280,height:1200})
  const initial=await measure()
  console.log('expanded local list',initial)
  assert(initial.gap>=0 && initial.gap<=24,`SSH grouping gap: ${initial.gap}px`)
  const localWorkspaces=page.locator('[role="tree"] [data-row-key^="workspace:"]')
  for(let index=0;index<await localWorkspaces.count();index++) {
    const workspace=localWorkspaces.nth(index)
    if(await workspace.getAttribute('aria-expanded')==='true') await workspace.click()
  }
  await host.click()
  const workspace=page.locator('[data-dsh-remote-row="workspace"]').first()
  await workspace.click()
  const sessions=page.locator('[data-dsh-remote-row="session"]:visible')
  await sessions.last().waitFor()
  for(const height of [1200,720,550]) {
    await page.setViewportSize({width:1280,height})
    await page.waitForFunction(()=>{
      const list=document.querySelector('[role="tree"]')
      const rows=[...list.querySelectorAll('[data-row-key]')].filter(row=>row.getClientRects().length)
      const bottom=Math.max(...rows.map(row=>row.getBoundingClientRect().bottom))
      const gap=document.querySelector('[data-dsh-remote-hosts="manageBar"]').getBoundingClientRect().top-bottom
      return gap>=0&&gap<=24
    })
    const size=await measure()
    assert(size.gap<=24)
    assert.equal(size.overflow,'auto')
    assert.equal(size.listOverflow,'visible')
    console.log('collapsed local list',height,size)
  }
  const compact=await measure()
  assert(compact.scrollHeight>compact.clientHeight,'short viewport must scroll')
  await sessions.last().scrollIntoViewIfNeeded()
  assert((await measure()).scrollTop>0)
  assert.equal(await fade.evaluate(node=>getComputedStyle(node).display),'none')
  const box=await sessions.last().boundingBox()
  assert(box.y>=0&&box.y+box.height<=550)
  await sessions.last().click()
  await page.waitForFunction(()=>window.verificationCtx.uiWorkspace.selection.getSnapshot().sessionId?.startsWith('remote:'))
  await page.evaluate(async()=>{await window.verificationCtx.uiWorkspace.mainReference.ready})
  await page.evaluate(()=>window.__DSH_REMOTE_HOSTS__.render())
  assert((await measure()).gap<=24)
  await page.evaluate(()=>window.__DSH_REMOTE_HOSTS__.stop())
  assert.equal(await page.locator('[data-dsh-remote-hosts="section"]').count(),0)
  assert.equal(await page.locator('[role="tree"]').evaluate(node=>getComputedStyle(node).overflowY),'auto')
  assert.equal(await page.locator('[class*="_treeBody"] > [class*="_fade"]').evaluate(node=>getComputedStyle(node).display),'block')
  assert.deepEqual(errors,[])
  console.log('PASS: compact local/SSH spacing, shared scrolling without a fade overlay, short/tall windows, session clicks and native scroll restoration')
} finally {await browser.close()}

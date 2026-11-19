import { chromium } from 'playwright-core'

export async function openLab(url) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(45000)
  const errors = []
  const sockets = []
  page.on('websocket', socket => sockets.push(socket))
  page.on('pageerror', error => {errors.push(error.message);if(process.env.DSH_TEST_LOG_CONSOLE==='1') console.log('pageerror',error.stack)})
  if (process.env.DSH_TEST_LOG_CONSOLE === '1') page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) console.log('browser', message.type(), message.text().slice(0, 1500))
  })
  await page.addInitScript(() => {
    let loader
    Object.defineProperty(window, '__ModuleLoader__', {
      configurable: true,
      get: () => loader,
      set(value) {
        loader = value
        let load = value.load.bind(value)
        const wrapped = specification => {
          if (specification.id === 'dsh-remote-hosts') {
            const factory = specification.factory
            specification.factory = (...args) => {
              window.verificationRequire = args[0]
              const plugin = factory(...args)
              const apply = plugin.apply
              plugin.apply = ctx => {
                window.verificationCtx = ctx
                const methods = [
                  ...['binding', 'retain', 'using', 'retainInfo', 'scope', 'scopeOf', 'sessionOf', 'retainAgentScope'].map(name => [ctx.sessions, name]),
                  ...['openSession', 'connectBlank', 'startSession'].map(name => [ctx.uiWorkspace, name]), [ctx.uiSession, 'materializeAbsent'],
                  [ctx.modelDirectories, 'directoryFor'], [ctx.remoteAccess, 'source'], [ctx.remoteAccess, 'whenResourceAccess'],
                  [ctx.fileUpload, 'upload'], [ctx.fileUpload, 'uploadImage'],
                  ...ctx.typert.remotes.list().filter(item => item.invocation.kind === 'direct').map(item => [ctx.get(`remote.${item.namespace}`), item.method]),
                ].filter(([target, name]) => typeof target?.[name] === 'function')
                window.verificationMethods = methods.map(([target, name]) => ({ target, name, descriptor: Object.getOwnPropertyDescriptor(target, name), value: target[name] }))
                return apply(ctx)
              }
              return plugin
            }
          }
          return load(specification)
        }
        Object.defineProperty(value, 'load', { configurable: true, get: () => wrapped, set: next => { load = next.bind(value) } })
      },
    })
  })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__DSH_REMOTE_HOSTS__?.snapshot().native?.patched === true, undefined, { timeout: 45000 })
  if (process.env.DSH_TEST_DISMISS_ONBOARDING === '1') {
    const preview = page.getByRole('dialog').filter({ hasText: '预览版说明' })
    await page.addLocatorHandler(preview, async () => {
      await preview.getByRole('button', { name: '继续', exact: true }).click()
    })
    const onboarding = page.getByRole('dialog').filter({ hasText: '开始使用' })
    await page.addLocatorHandler(onboarding, async () => {
      await onboarding.getByRole('button', { name: '关闭', exact: true }).click()
    })
  }
  return { browser, page, errors, sockets }
}

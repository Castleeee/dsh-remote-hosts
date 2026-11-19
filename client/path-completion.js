export function attachPathCompletion({input,mark,listDirectories}) {
  const lifetime = new AbortController()
  const field = document.createElement('div')
  field.setAttribute(mark,'pathField')
  input.before(field)
  field.append(input)
  const viewport = document.createElement('div')
  viewport.setAttribute(mark,'pathViewport')
  const list = document.createElement('div')
  list.setAttribute(mark,'pathSuggestions')
  list.id = `remote-path-${crypto.randomUUID()}`
  list.setAttribute('role','listbox')
  list.setAttribute('aria-label','远端目录候选')
  list.hidden = true
  const status = document.createElement('div')
  status.setAttribute(mark,'pathStatus')
  status.setAttribute('role','status')
  viewport.append(list)
  field.append(viewport)
  field.after(status)
  input.setAttribute('role','combobox')
  input.setAttribute('aria-autocomplete','list')
  input.setAttribute('aria-controls',list.id)
  input.setAttribute('aria-expanded','false')
  input.autocomplete = 'off'
  let homeRequest, timer, loadingTimer, pending, generation = 0, selected = -1, choices = [], loading = false
  const cache = new Map()
  const hint = '↑ ↓ 选择，Enter 或 Tab 补全；~/ 表示远端主目录。'
  status.textContent = hint
  function remember(listing) {
    cache.delete(listing.path)
    cache.set(listing.path,{listing,expires:Date.now()+15000})
    if (cache.size > 32) cache.delete(cache.keys().next().value)
    return listing
  }
  const home = () => homeRequest ??= listDirectories(undefined,lifetime.signal).then(remember)
  async function resolve(value) {
    if (value === '') throw new Error('路径不能为空')
    const listing = await home()
    if (value === '~') return listing.home
    if (value.startsWith('~') && !value.startsWith('~/')) throw new Error('请使用 ~/ 表示这台机器的主目录。')
    if (value.startsWith('/')) return value
    return `${listing.home.replace(/\/$/,'')}/${value.startsWith('~/') ? value.slice(2) : value}`
  }
  function hide() {
    list.hidden = true
    input.setAttribute('aria-expanded','false')
    input.removeAttribute('aria-activedescendant')
    selected = -1
  }
  function highlight(index) {
    selected = index
    const rows = [...list.children]
    rows.forEach((row,i) => row.setAttribute('aria-selected',String(i === selected)))
    input.setAttribute('aria-activedescendant',rows[selected].id)
    rows[selected].scrollIntoView({block:'nearest'})
  }
  function choose(index) {
    if (loading) return
    input.value = `${choices[index].path.replace(/\/$/,'')}/`
    input.focus()
    schedule(0)
  }
  async function update(version,value,signal) {
    try {
      const initial = await home()
      const expanded = await resolve(value || '~')
      const slash = expanded.lastIndexOf('/')
      const homeInput = value === '' || value === '~'
      const directory = homeInput ? initial.home : expanded.endsWith('/') ? expanded : expanded.slice(0,slash) || '/'
      const parent = directory === '/' ? directory : directory.replace(/\/+$/,'')
      const prefix = homeInput || expanded.endsWith('/') ? '' : expanded.slice(slash+1)
      const cached = cache.get(parent)
      const listing = cached && cached.expires > Date.now() ? cached.listing : remember(await listDirectories(parent,signal))
      if (version !== generation || signal.aborted) return
      clearTimeout(loadingTimer)
      loading = false
      viewport.setAttribute('aria-busy','false')
      choices = listing.entries.filter(entry => entry.name.startsWith(prefix) && (!entry.hidden || prefix.startsWith('.'))).slice(0,20)
      list.replaceChildren()
      selected = -1
      input.removeAttribute('aria-activedescendant')
      for (const [index,entry] of choices.entries()) {
        const option = document.createElement('button')
        option.type = 'button'
        option.tabIndex = -1
        option.id = `${list.id}-${index}`
        option.setAttribute('role','option')
        option.setAttribute('aria-selected','false')
        option.textContent = `${entry.name}/`
        option.title = entry.path
        option.onmousedown = event => event.preventDefault()
        option.onclick = () => choose(index)
        list.append(option)
      }
      list.hidden = choices.length === 0
      list.scrollTop = 0
      input.setAttribute('aria-expanded',String(choices.length > 0))
      status.dataset.error = 'false'
      status.textContent = !choices.length ? '没有匹配的目录，可继续输入完整路径。' : listing.truncated || choices.length === 20 ? '目录较多，请继续输入名称筛选。' : hint
    } catch(error) {
      if (version !== generation || signal.aborted || lifetime.signal.aborted) return
      clearTimeout(loadingTimer)
      loading = false
      viewport.setAttribute('aria-busy','false')
      hide()
      status.dataset.error = 'true'
      status.textContent = error.code === 'directory-picker/unreadable' ? '远端目录不存在或没有读取权限。' : error.message
    }
  }
  function schedule(delay = 100) {
    clearTimeout(timer)
    clearTimeout(loadingTimer)
    pending?.abort()
    loading = true
    selected = -1
    input.removeAttribute('aria-activedescendant')
    list.querySelectorAll('button').forEach(button => {button.disabled=true;button.setAttribute('aria-selected','false')})
    viewport.setAttribute('aria-busy','true')
    const version = ++generation
    const value = input.value
    pending = new AbortController()
    const signal = AbortSignal.any([pending.signal,lifetime.signal])
    status.dataset.error = 'false'
    loadingTimer = setTimeout(() => {if (version === generation) status.textContent='正在读取远端目录…'},250)
    timer = setTimeout(() => {void update(version,value,signal)},delay)
  }
  const changed = () => schedule()
  const focused = () => schedule(0)
  const blurred = () => {
    clearTimeout(timer)
    clearTimeout(loadingTimer)
    pending?.abort()
    generation++
    loading = false
    viewport.setAttribute('aria-busy','false')
    hide()
    status.textContent = hint
  }
  const keydown = event => {
    if (event.isComposing || loading) return
    if (list.hidden || !choices.length) return
    if (['ArrowDown','ArrowUp','Escape'].includes(event.key) || event.key === 'Tab' && !event.shiftKey || event.key === 'Enter' && selected >= 0) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {blurred();return}
      if (event.key === 'Enter' || event.key === 'Tab') {choose(Math.max(0,selected));return}
      highlight(event.key === 'ArrowDown' ? (selected+1)%choices.length : (selected < 0 ? choices.length-1 : (selected-1+choices.length)%choices.length))
    }
  }
  input.addEventListener('input',changed)
  input.addEventListener('focus',focused)
  input.addEventListener('blur',blurred)
  input.addEventListener('keydown',keydown,true)
  return {
    resolve,
    dispose() {
      clearTimeout(timer)
      clearTimeout(loadingTimer)
      generation++
      lifetime.abort()
      pending?.abort()
      input.removeEventListener('input',changed)
      input.removeEventListener('focus',focused)
      input.removeEventListener('blur',blurred)
      input.removeEventListener('keydown',keydown,true)
    },
  }
}

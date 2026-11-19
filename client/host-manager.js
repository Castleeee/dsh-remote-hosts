export function openSshManager({ gateway, mark, close, connected }) {
  const element = (tag, text, marker) => {
    const node = document.createElement(tag)
    if (text) node.textContent = text
    if (marker) node.setAttribute(mark,marker)
    return node
  }
  const backdrop = element('div','', 'dialogBackdrop')
  const panel = element('div','', 'hostManager')
  panel.setAttribute('role','dialog')
  panel.setAttribute('aria-modal','true')
  panel.setAttribute('aria-label','远程机器管理')
  const dismiss = element('button','×','close')
  dismiss.setAttribute('aria-label','关闭机器管理')
  dismiss.onclick = close
  const description = element('p','读取 SSH 配置，与 VS Code 共用机器和连接选项。','muted')
  const path = element('div','','hostManagerSubhead')
  const status = element('div','','hostManagerStatus')
  status.setAttribute('role','status')
  const list = element('div','','sshHosts')
  const form = element('form','','sshCommand')
  const input = element('input')
  input.placeholder = 'ssh root@hostname -p 22'
  input.setAttribute('aria-label','SSH 连接命令')
  input.autocomplete = 'off'
  const add = element('button','添加新机器')
  add.type = 'submit'
  const refresh = element('button','刷新配置')
  refresh.type = 'button'
  const challenge = element('form','','sshChallenge')
  challenge.hidden = true
  const prompt = element('label')
  const answer = element('input')
  answer.setAttribute('aria-label','SSH 认证输入')
  answer.autocomplete = 'off'
  const submit = element('button','确定')
  submit.type = 'submit'
  const cancel = element('button','取消连接')
  cancel.type = 'button'
  challenge.append(prompt,answer,submit,cancel)
  const installation = element('section','','installConfirmation')
  installation.hidden = true
  installation.setAttribute('role','group')
  installation.setAttribute('aria-label','安装确认')
  const installationTitle = element('h4','安装远端 DSH 与运行环境')
  const installationDetails = element('p')
  const installationPath = element('p','安装目录：~/.local/share/dsh-remote-hosts；会话与配置：~/.dsh。','muted')
  const backgroundHint = element('p','确认安装后，关闭此窗口仍会在后台继续；重新打开可查看进度或取消安装。','muted')
  const approve = element('button','安装并连接')
  approve.type = 'button'
  const decline = element('button','拒绝并断开')
  decline.type = 'button'
  installation.append(installationTitle,installationDetails,installationPath,backgroundHint,approve,decline)
  form.append(input,add,refresh)
  panel.append(dismiss,element('h3','远程机器管理'),description,path,status,list,form,challenge,installation)
  backdrop.append(panel)
  backdrop.onclick = event => {if (event.target === backdrop) close()}
  backdrop.onkeydown = event => {
    if (event.key === 'Escape') {event.stopPropagation();close()}
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button,input')].filter(node => !node.disabled && node.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus()}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus()}
    }
  }
  document.body.append(backdrop)
  let timer
  let disposed = false
  let active
  let challengeId
  let installationId
  let installationDecision
  let lastHosts = ''
  let completed = new Set()
  const phases = {checking:'检查中…','awaiting-installation':'等待确认','awaiting-url':'等待认证地址',installing:'安装中…',preparing:'启动中…',connecting:'连接中…',cancelling:'取消中…'}
  const request = async payload => {
    const response = await fetch(`${gateway}/manage/ssh`, {method:payload ? 'POST':'GET',headers:payload && {'content-type':'application/json'},body:payload && JSON.stringify(payload),signal:AbortSignal.timeout(20000)})
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`)
    return result
  }
  const perform = async operation => {
    try { await operation() } catch(error) {status.textContent=error.message;status.dataset.error='true'}
  }
  const connect = async alias => {
    const result = await request({action:'connect',alias})
    active = result.operation.id
    if (disposed) {await request({action:'dismiss',id:active});return}
    status.dataset.error='false'
    status.textContent = `正在连接 ${alias}…`
    lastHosts = ''
    await poll()
  }
  const poll = async () => {
    if (disposed) return
    clearTimeout(timer)
    try {
      const data = await request()
      if (disposed) return
      path.textContent = data.configFile
      const hostKey = JSON.stringify([data.hosts,data.operations.map(op => [op.id,op.alias,op.phase])])
      if (lastHosts !== hostKey) {
        lastHosts = hostKey
        list.replaceChildren()
        for (const host of data.hosts) {
          const row = element('div','','hostManagerRow')
          row.dataset.sshAlias = host.alias
          const label = element('span',host.alias)
          const meta = element('span',host.configFile,'muted')
          meta.className = 'meta'
          const actions = element('div')
          actions.className = 'actions'
          const button = element('button','连接')
          const operation = data.operations.findLast(op => op.alias === host.alias)
          button.disabled = Boolean(phases[operation?.phase])
          button.textContent = phases[operation?.phase] || (operation?.phase === 'ready' ? '重新连接' : '连接')
          button.onclick = () => perform(() => connect(host.alias))
          actions.append(button)
          if (operation?.phase === 'installing') {
            const cancelInstall = element('button','×')
            cancelInstall.type = 'button'
            cancelInstall.setAttribute('aria-label',`取消 ${host.alias} 的安装`)
            cancelInstall.title = '取消安装'
            cancelInstall.onclick = () => perform(async () => {
              cancelInstall.disabled = true
              try {await request({action:'cancel',id:operation.id});active=operation.id;await poll()}
              finally {cancelInstall.disabled=false}
            })
            actions.append(cancelInstall)
          }
          row.append(label,meta,actions)
          list.append(row)
        }
        if (!data.hosts.length) list.append(element('p','SSH 配置中还没有机器。','muted'))
      }
      const operation = data.operations.find(op => op.id === active) ?? data.operations.findLast(op => op.prompt || op.installation || phases[op.phase]) ?? data.operations.at(-1)
      if (operation) {
        active = operation.id
        status.dataset.error='false'
        if (operation.prompt) {
          challenge.hidden = false
          if (challengeId !== operation.prompt.id) {
            challengeId = operation.prompt.id
            challenge.dataset.challengeId = challengeId
            prompt.textContent = operation.prompt.text
            answer.type = operation.prompt.secret ? 'password':'text'
            answer.setAttribute('aria-label',operation.prompt.kind === 'dsh-url' ? 'DSH 服务 URL' : 'SSH 认证输入')
            answer.value = ''
            answer.placeholder = operation.prompt.kind === 'dsh-url' ? 'http://127.0.0.1:端口/?token=…' : operation.prompt.secret ? '密码或密钥口令':'确认主机指纹后输入 yes'
            answer.focus()
          }
        } else {challenge.hidden=true;challengeId=undefined;answer.value=''}
        if (operation.installation) {
          installation.hidden = false
          if (installationId !== operation.installation.id) {
            installationId = operation.installation.id
            const plan = operation.installation
            const changes = []
            if (plan.installDsh) changes.push(`DSH ${plan.dshVersion} 及其 npm 包依赖`)
            if (plan.installNode) changes.push(`Node.js ${plan.nodeVersion}（包含 npm）`)
            installationDetails.textContent = `将通过 SSH 命令在 ${operation.alias} 上安装：\n${changes.join('\n')}\n${plan.installNode ? `现有 Node.js ${plan.existingNode ?? '未安装'}，准备环境需要 Node.js ≥24.9.0 和 npm；新运行环境单独安装。` : `复用已有 Node.js ${plan.existingNode}。`}\n确认后安装、启动 DSH 并连接；拒绝将结束本次连接。`
            approve.disabled = false
            decline.disabled = false
            approve.focus()
          }
        } else {installation.hidden=true;installationId=undefined}
        if (operation.phase === 'checking') status.textContent=`正在检查 ${operation.alias} 上的 DSH 与运行环境…`
        if (operation.phase === 'awaiting-installation') status.textContent='等待确认安装；尚未执行安装。'
        if (operation.phase === 'awaiting-url') status.textContent=`${operation.alias} 已有运行中的 DSH，等待认证地址。`
        if (operation.phase === 'preparing') status.textContent=`正在准备 ${operation.alias} 上的 DSH…`
        if (operation.phase === 'installing') status.textContent=`正在安装 ${operation.alias} 上的 DSH 与运行环境；关闭窗口后会继续在后台安装。`
        if (operation.phase === 'cancelling') status.textContent='正在取消并停止远端准备进程…'
        if (operation.phase === 'connecting') status.textContent=`正在连接 ${operation.alias}…`
        if (operation.phase === 'ready' && !completed.has(operation.id)) {
          completed.add(operation.id)
          status.textContent=`已连接 ${operation.alias}`
          await connected()
        }
        if (operation.phase === 'failed' || operation.phase === 'cancelled') {status.dataset.error='true';status.textContent=operation.error || '连接已取消'}
      }
    } catch(error) {status.textContent=error.message;status.dataset.error='true'}
    finally {if (!disposed) timer=setTimeout(poll,700)}
  }
  form.onsubmit = event => {
    event.preventDefault()
    void perform(async () => {
      add.disabled=true
      try {
        const result = await request({action:'add',command:input.value})
        input.value=''
        await connect(result.alias)
      } finally {add.disabled=false}
    })
  }
  refresh.onclick = () => {lastHosts='';void poll()}
  challenge.onsubmit = event => {
    event.preventDefault()
    const value=answer.value
    answer.value=''
    void perform(async () => {await request({action:'answer',id:challengeId,answer:value});await poll()})
  }
  cancel.onclick = () => perform(async () => {await request({action:'cancel',id:active});status.textContent='连接已取消';await poll()})
  const decideInstallation = accepted => perform(async () => {
    approve.disabled = true
    decline.disabled = true
    try { await request({action:'confirm-installation',id:active,confirmationId:installationId,accepted});await poll() }
    finally {approve.disabled=false;decline.disabled=false}
  })
  approve.onclick = () => {installationDecision=decideInstallation(true)}
  decline.onclick = () => {installationDecision=decideInstallation(false)}
  backdrop.dispose = () => {
    disposed=true
    clearTimeout(timer)
    answer.value=''
    if (active && !completed.has(active)) void (async () => {
      await installationDecision
      await request({action:'dismiss',id:active})
    })().catch(error => console.warn('[remote-hosts]',error.message))
  }
  void poll()
  input.focus()
  return backdrop
}

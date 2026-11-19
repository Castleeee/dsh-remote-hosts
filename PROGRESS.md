# 当前实施与验收

2026-11-19，本机适配官方 DSH `0.2.2-rc.1`、`0.2.2-rc.3`；构建数据层和远端验收版本为 `0.2.2-rc.1`。源码位置：`/Users/jack/code/dddd/dsh-remote-hosts`。

## 侵入性与维护优化

- 原生服务适配集中到 `client/native-adapter.js`，释放逻辑集中到 `client/lifetime.js`，插槽订阅与包装释放集中到 `client/slot-adapter.js`，版本和能力检查集中到 `client/compatibility.js`。
- 根 Remote 接口中，仅包装明确列出的 28 个会话、工作区及命令接口；依据官方描述符读取身份参数，普通标题、命令文字和查询内容保持原值。根目录查询、搜索和全局配置继续使用原生服务。`uiWorkspace.openSession` 与 `sessions.scopeOf` 保留原方法。
- 插槽使用官方 `slots.subscribe` 分别订阅，按组件名称、locale 和必要的 `options.id` 识别原生目标；其他菜单组件保持自己的注入函数，目标组件移除时立即释放包装。
- 远程模型目录直接构造宿主公开的 `ModelDirectory`，使用所属机器的 catalog 和投影，随会话作用域释放。
- 方法恢复检查属性归属，保留其他插件随后安装的包装；停用后，其他插件持有的旧包装直接调用原方法。UI 来源先于方法包装释放，初始化中途失败使用同一清理流程。
- 侧栏使用稳定节点和 morphdom 更新变化的机器组，保留焦点；观察范围限制在侧栏及外层容器的直接子节点，会话列表订阅替代定时修补。
- 删除独立抽屉聊天与悬浮入口，统一使用原生聊天界面。
- gateway 默认使用系统分配端口，通过官方 `webserver/index-inject` 发布地址；两个独立 gateway 的同时运行和端口释放通过真实 HTTP 验证。
- 构建及启用前检查受支持版本。侧栏 DOM、StoredEntry.inject、catalog 构造类和部分会话接口仍依赖上游内部结构；升级需要重新验收。

## 本轮实现

- 已有环境检查覆盖 PATH、NVM、插件目录，以及 Linux 上同一用户、相同 HOME 的官方 DSH 进程。发现运行服务后连接原端口，保留原进程、DSH_HOME、模型和会话；验证保存的服务信息或普通日志中的认证信息，无法取得时提示输入已有服务启动 URL。已有运行环境不触发 Node.js 安装，启动已有 DSH 不要求 npm。检测到不支持的 DSH 版本明确报错。
- 机器管理直接读取 `~/.ssh/config` 及 Include 文件，与 VS Code 共用。输入 SSH 命令可添加机器并连接，端口与 DSH 认证信息自动准备。
- 新建远程工作区通过所属机器的官方目录接口查询候选，支持名称过滤、鼠标与键盘补全；`~/` 和相对路径按远端主目录展开，目录读取失败明确提示，关闭时取消请求。
- 安装前通过 SSH 只读检查环境，提示本次需要安装的内容、版本和目录；确认后安装 DSH `0.2.2-rc.1`，按需补装 Node.js `24.20.0`（含 npm）。已有 Node.js ≥`24.9.0` 与 NVM 环境直接复用。确认前拒绝、关闭窗口或失效确认不会执行安装或建立 DSH 转发；准备脚本也检查安装授权。
- 安装阶段独立显示“安装中…”及取消按钮。确认后关闭管理窗口或浏览器继续在 Host 后台执行，重新打开恢复进度；取消操作通过 SSH 控制通道停止本次远端进程及子进程。Node.js 和 DSH 在本次安装目录内完成后再移动到使用目录，取消后清理未完成内容。
- OpenSSH 保留 Host/Match、密钥、跳板机、保活和超时设置，按需通过 SSH_ASKPASS 输入密码、口令及主机指纹确认；密码不写入配置。
- 侧栏本地与远端分别显示，字号、行高和文字水平位置复用原生样式；机器与工作区折叠保持状态，移除横线。
- 原生本地列表使用本地摘要来源；远端 DOM 位于原生动画列表外。本地新建、发送、切换到远端再返回通过真实浏览器验收。
- 原生聊天绑定复用官方 `Session`，接入 assistant-stream、历史窗口、分页、发送回显、取消、队列、命令和图片读取。
- 每台机器独立 HTTP/WS 传输，依据官方 Typert 描述符映射普通及 scoped RPC；协议身份转换拒绝跨机器参数。
- 远程 Session 使用官方 Context 作用域，审批与问题 waterfall 在所属会话派发，引用保留覆盖交互期间。
- 问题取消通过官方错误投影返回 `rejected` outcome，保留错误名称、`ASK_CANCELLED` 和可序列化详情。
- 模型目录按机器独立缓存，原生模型选择器读取完整真实远端目录和选择投影。
- 远程侧栏订阅宿主 `uiSession.sessionStatus` 并复用原生 `StateDot`：运行转圈、等待问题／审批的黄点和后台完成提醒实时更新；打开会话清除完成未读，处理交互后恢复时间。组件容器在侧栏更新时保留，行移除和停用时卸载。
- 权限读取远端 `remoteAccess/follow`，资源来源和 effect guard 按机器分发。
- 原生空会话获得远端工作区来源，输入框能够正常使用。
- 引用计数与 `using/ready/release` 生命周期完善，最后一个引用释放后关闭作用域与历史流；禁用恢复原属性描述符，支持重新启用。
- 机器移除时清理对应会话、传输、事件和模型目录；状态加载防止过期异步结果写回。
- 机器参数校验、占用端口报错、自有 SSH 进程管理、配置编辑持久化、原子保存和管理操作顺序处理已接入。
- README、产品约束、安装、设计及接口文档统一为当前实现。

## 真实测试结果

所有网络测试均使用真实服务。远端统一通过 `ssh root@jack-dirty-linux -p 22` 访问；隔离测试在同一机器启动两个独立 DSH_HOME。

| 场景 | 结果与证据 |
|---|---|
| 构建 | `npm run build` 通过；生成插件专用 `client/client.js` |
| Gateway 与 SSH 配置回归 | `npm test`：6 项通过；真实运行环境检测与未经授权安装的写入拦截、独立 gateway 动态端口、真实 HTTP/WS Origin、非法参数、端口冲突、保存权限、重启保留编辑、无关监听进程保留；系统 ssh -G 确认 Include、30 秒保活、端口及新机器配置 |
| 自定义安装及已有运行服务 | `test/runtime-discovery.mjs`：普通非交互 SSH 发现自定义官方 DSH、Node.js 和 DSH_HOME；取消 URL 输入和错误认证地址均不保存机器或建立转发；正确地址通过真实认证和会话查询，原端口与 PID 保持，后续连接复用凭据。管理响应不包含 token |
| 已有安装启动与安装取消回归 | `test/installation-consent.mjs` 已有环境模式：真实 NVM Node.js 和官方 DSH 直接启动；缺少 DSH 时仅提示 DSH 安装，拒绝保持环境；后台 npm 安装在关闭窗口后继续，重新打开可取消并清理；删除本地机器记录后自动发现原服务并复用端口；自定义目录的 DSH 经 NVM 可执行目录发现，缺少 npm 时仍能启动，未创建第二套安装。专用用户与 sshd 已清理 |
| 原生兼容和其他插件共存 | `test/compatibility.mjs`：151 个根 Remote 接口仅包装明确列出的 28 个；`scopeOf` 保留原方法，普通 `remote:` 前缀标题和命令在本地执行；无关 header 插件的注入函数保持原值，复用原生 Agent 标签的插件卸载后立即恢复注入函数；停用恢复原属性描述符，另一个真实 Cordis 插件的后续包装保留；本地 retain、列表和模型加载正常，真实 UI 来源冲突触发的中途启用失败清理完整，解除冲突后重新启用成功 |
| 侧栏更新 | 真实刷新及远端改名后，会话节点保持相同 DOM 对象，键盘焦点保留 |
| 远程侧栏状态 | `test/sidebar-status.mjs`：真实前台命令验证原生 14px 动画转圈；后台完成显示完成点，打开后清除；真实问题和审批显示原生黄点及待处理文字，跨会话切换保留，回答或拒绝后恢复空闲；停用移除组件及订阅，无页面异常 |
| SSH 配置界面 | `test/host-manager.mjs`：读取真实共享配置，输入 ssh root@jack-dirty-linux -p 22，连接成功且配置未重复追加 |
| 远端路径提示 | `test/path-completion.mjs`：真实目录、文件、软链接、隐藏目录、中文与空格路径；点击及方向键／Enter／Tab 补全、无效路径提示、快速输入和关闭清理通过；`~/` 展开后实际创建远端工作区并更新原生侧栏，测试注册与目录已清理 |
| 目录切换稳定性 | `test/path-completion.mjs` 连续记录浏览器动画帧，往返有内容和空目录时，窗口高度、输入位置、目录区域和按钮位置完全不变；重复进入目录仅发生一次真实目录查询，原有补全及工作区创建回归通过。结果在 `.verification/path-completion-smooth.log`，Firefox 实际选择目录及提交回归在 `.verification/path-completion-smooth-firefox.log` |
| 密码认证 | `test/ssh-password.mjs`：独立真实 sshd，指纹核对、错误密码重试、正确密码、真实 DSH HTTP 转发、密码清理和取消连接通过；专用用户及服务已清理 |
| 新机器自动准备 | 独立远端 HOME 从空目录安装官方 DSH，自动启动、取得端口与认证信息、真实 SSH HTTP 请求及重复连接复用通过；专用 DSH 服务已停止 |
| 安装确认与后台执行 | `test/installation-consent.mjs`：真实独立用户和 sshd；确认前拒绝、关闭窗口、过期确认后无安装目录及 DSH 转发。确认后关闭管理窗口，后台实际安装 Node.js `24.20.0` 与 DSH `0.2.2-rc.1` 并完成真实认证与 API 请求。安装行状态和取消按钮通过浏览器操作验证；取消真实 curl 下载和 npm 安装后，远端安装进程停止，未完成目录清理，未建立连接。已有官方 DSH 与 NVM Node.js 的专项验收通过，服务工作目录有效；关闭窗口和浏览器页面后重新打开恢复 npm 安装进度，取消后保留已安装 Node.js |
| 侧栏和本地切换 | `test/sidebar.mjs`：本地/远端行高 32px、标题 14px、水平位置相同；无横线、折叠、选择、刷新、原生本地消息及远端切换、禁用清理通过 |
| 侧栏高度与滚动 | `test/sidebar-height.mjs`：本地列表按内容高度排列，本地与 SSH 分组间隔 12px；1200、720、550px 高度下排列稳定，共用滚动区域，底部远程会话可滚动到达并打开，停用恢复原生滚动 |
| 真实 SSH | `test/ssh-integration.mjs` 通过；隧道连接、编辑替换、token 留空保留、错误 token 拒绝、更新恢复、移除及停止释放端口 |
| SSH 真实中断恢复 | 终止 gateway 所属 SSH 转发进程，远端连接关闭后自动重建；原生会话保留相同 binding，标题投影和 scoped commands.list 恢复；既有真实历史的 155 条事件完整保留且 seq 无重复 |
| 两个远端环境 | `test/integration.mjs` 通过；独立会话、scope、模型目录；一个目录包含 opencode-go，另一个为空，状态互不混用 |
| 本地回归 | 创建并保留真实本地会话；远端操作期间本地 binding 与模型目录保持一致 |
| 原生新会话 | 打开远端空会话，工作区标签正确，真实可编辑原生 composer 出现 |
| 原生新建入口与菜单 | `test/new-session.mjs`：真实侧栏按钮直接进入原生页面，连续点击仅创建一次；原生 Agent 菜单读取远端预设和开发工具设置，切换 PTC 后远端投影更新；原生模型菜单显示远端 OpenCode Go / DeepSeek V4.1 Flash；重复新建保留空白会话、未发送草稿和 Agent 选择；原生工作区菜单通过远端目录提示创建工作区、切换工作区并传递草稿；本地新建和菜单回归、后续导航覆盖尚未完成的远端创建通过；通过原生输入框获得真实模型回复，原生会话标题显示 PTC；测试会话归档，专用工作区和目录清理 |
| 模型选择 | 真实远端目录显示 DeepSeek V4.1 Flash；原生 ModelDirectory.select 成功；作用域模型投影更新 |
| Slash command | `/permission` 在远端执行且 matched=true；scoped `commands.list()` 返回真实的 6 条命令 |
| 运行中停止 | 原生停止按钮中断真实前台 sleep 命令；远端 job 状态为 killed，turn/end 为 aborted，原因为 user |
| 原生队列 | 真实前台命令运行期间添加消息；通过原生按钮编辑、保存、删除和插话发送；远端回复 DSH_QUEUE_EDITED，被删除消息未进入用户正文 |
| 原生审批 | 原生卡片分别拒绝和允许 danger-full-access 的专用文件写入；SSH 确认拒绝时文件不存在，允许时正文为 DSH_APPROVAL_OK，随后清理文件 |
| 原生问题 | 模型实际调用 ask_user_question；原生单选及提交后，远端回复 DSH_QUESTION_OK 继续验收 |
| 问题取消 | 原生“放弃整组问题”向远端返回 rejected / UserQuestionError / ASK_CANCELLED，远端工具结果保留取消原因，模型正常结束 |
| 文件上传 | 通过原生 fileUpload 上传真实 README.md，远端返回附件存储标识、字节数及 receipt |
| 历史图片 | 原有真实会话的图片通过官方 Session.readAttachment 回读成功，70 字节 |
| 真实历史分页 | 官方 SessionEventStream 使用 2 条消息窗口：尾页从 seq 150 开始，prepend 后从 seq 141 开始；事件数量 5→14，无重复 seq |
| 原生成功回复 | OpenCode Go / DeepSeek V4.1 Flash 通过原生输入框发送后返回 DSH_REMOTE_REAL_OK；running 经历 true→false，正文分块抵达，transient 全部结算，持久事件 seq 无重复 |
| 引用与清理 | 释放幂等，已释放引用不能借用 binding；远端引用计数减少；禁用后远端行清除、方法恢复，重新启用正常，无页面异常 |
| 包内容 | `npm pack --dry-run --json` 检查通过；包内不包含机器配置、测试日志或 token |

本轮优化验收结果保存在已忽略的 `.verification/optimization-*.log`，包括 compatibility、integration、interactions、question-cancel、sidebar、height、hosts、password、ssh、reconnect 和 finalize。交互回归脚本为 `test/native-interactions.mjs` 与 `test/question-cancel.mjs`；断线验收为 `test/reconnect.mjs`。测试登录日志含敏感 token，不适合分享。

已有 DSH 与运行环境的专项验收结果保存在 `.verification/installation-existing.log`，密码认证及原生管理窗口回归分别在 `.verification/installation-password.log`、`.verification/installation-host-manager.log`。完整安装首次验收成功，补充重复安装时 npm registry 下载请求超时，记录在 `.verification/installation-consent.log`；该次未建立 DSH 连接，专用环境已清理。

侧栏状态修复验收在 `.verification/sidebar-status.log`，侧栏尺寸和本地切换回归在 `.verification/sidebar-status-layout.log`，服务恢复、其他插件共存和初始化失败清理回归在 `.verification/sidebar-status-compatibility.log`。

后台安装与取消专项结果在 `.verification/installation-background-existing.log`，密码认证和原生管理窗口回归在 `.verification/installation-background-password.log`、`.verification/installation-background-host-manager.log`。构建、6 项基础测试与包内容检查通过；专用测试用户、sshd、安装进程和本地临时 gateway 已清理。完整下载仍受远端 npm registry 响应影响，重复下载遇到请求停滞时通过取消接口停止测试任务。

远端路径补全验证在 `.verification/path-completion.log`；原生机器管理回归在 `.verification/workspace-network-hosts.log`。Firefox 验证在 `.verification/workspace-firefox-network.log`：访问当前 gateway 和两台远端目录接口成功，通过真实界面选择目录、展开 `~/` 并提交官方工作区接口，复用已有注册且无重复创建；访问已关闭的旧 gateway 复现 `NetworkError when attempting to fetch resource.`。Host 重启导致 gateway 端口变化时，已打开的旧页面需要刷新。

原生新建入口验收记录在 `.verification/native-new-session.log`；兼容测试同时检查 `startSession/connectBlank` 原属性及原生菜单注入函数完整恢复，记录在 `.verification/native-new-compatibility.log`。Firefox 的实际新建、远端 Agent 切换及空白会话复用记录在 `.verification/native-new-firefox.log`。6 项基础测试通过，记录在 `.verification/native-new-unit.log`。

侵入性优化验收在 `.verification/intrusion-compatibility.log`；原生新建、Agent、模型和工作区菜单及真实回复回归在 `.verification/intrusion-new-session.log`，Firefox 的远端 Agent 切换和空白会话草稿保留在 `.verification/intrusion-firefox.log`。真实聊天、问题回答、停止、队列编辑／删除／插话及审批允许／拒绝通过，记录在 `.verification/intrusion-interactions.log`；6 项基础测试在 `.verification/intrusion-unit.log`。

桌面端内置 DSH `0.2.2-rc.3` 在独立 profile 运行，与远端 `0.2.2-rc.1` 完成真实新建、Agent 与模型菜单、工作区创建和切换、草稿保留、本地会话回归及成功模型回复，记录在 `.verification/desktop-lab/new-session.log`。159 个根接口仅包装 28 个、方法及插槽恢复、真实其他插件共存、初始化失败清理和侧栏焦点保持通过，记录在 `.verification/desktop-lab/compatibility.log`；6 项基础测试在 `.verification/desktop-lab/unit.log`。

## 当前限制

默认 50 条消息窗口的 `Session.loadOlder/loadThrough` 需要更长的真实会话；小窗口分页结果不能代替该项验收。服务重启、活动流式期间中断后的结算、子代理完整路由、远端文件动作、侧栏完整键盘/右键/拖拽仍待验证，见 [ROADMAP.md](./ROADMAP.md)。

Desktop 使用线上发布包安装，见 [INSTALL.md](./INSTALL.md)。本机版本通过包声明、客户端支持列表和接口能力检查限制；远端已有服务尚未实现完整版本协商，不会自动升级已有环境。

## 测试环境与清理

- lab：`/Users/jack/code/dddd/.dsh-lab`，网页端口 `43140`，gateway 由系统分配；实际地址通过 `window.__DSH_REMOTE_HOSTS__.snapshot().gateway` 取得。
- 主测试远端：`/root/dsh-test/home`，官方 DSH 端口 `18081`，本地 SSH 转发 `18081`。保留运行供继续验收。
- 隔离远端：`/root/dsh-test/isolation-home`，测试端口 `18082`；隔离机器已从 gateway 移除，专用 DSH 进程已停止。
- 本轮远端专用测试会话通过官方 API 归档，既有历史会话保留。
- 独立 SSH 测试脚本的临时 gateway、隧道与配置目录均已清理。
- 关闭保留的 lab 时终止对应 DSH 进程；Host 插件会停止 gateway 和自身 SSH 隧道。远端主 DSH 服务独立运行。

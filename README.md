# dsh-remote-hosts

在本地 DSH 中管理 SSH 机器、远程工作区和会话，使用 DSH 原生聊天界面。远端运行官方 DSH，无需安装本插件。

本机适配 DSH `0.2.2-rc.1`、`0.2.2-rc.3`，远端验收版本为 `0.2.2-rc.1`。真实远端的成功回复、流式结算、运行中停止、队列、审批和问题交互已通过 lab 验收，详见 [PROGRESS.md](./PROGRESS.md)。

## 使用

1. 在本地 DSH 的插件管理器中安装 `https://github.com/Castleeee/dsh-remote-hosts/releases/download/v0.0.3/dsh-remote-hosts-0.0.3.tgz`，重启目标 profile。也可以从 [Releases](https://github.com/Castleeee/dsh-remote-hosts/releases) 下载 `.tgz` 文件安装。
2. 打开侧栏“机器管理”，直接选择 `~/.ssh/config` 中的机器连接。
3. 添加新机器时输入 `ssh root@host -p 22` 或 `root@host -p22`。配置写入同一 SSH 文件，VS Code 可以直接使用。
4. SSH 需要密码、密钥口令或主机指纹确认时，界面才显示认证输入。密码不保存。
5. 连接时先通过 SSH 检查远端环境。需要安装时显示内容、版本和目录，点击“安装并连接”后才执行；尚未确认时拒绝或关闭窗口会结束本次连接。安装阶段显示“安装中…”及取消安装的 `×` 按钮；确认后关闭窗口会继续在后台执行，重新打开可查看进度或取消。安装完成后取得认证信息并分配转发端口。展开机器标题，在工作区下面打开或新建会话。机器旁边的 `+` 创建远程工作区，工作区旁边的按钮创建会话。

SSH 复用 `~/.ssh/config` 及 Include 文件，系统 OpenSSH 处理 Host、Match、IdentityFile、ProxyJump、端口和保活设置。插件不覆盖 `ServerAliveInterval`、`ServerAliveCountMax` 或 `ConnectTimeout`。读取列表不会连接其他机器；插件只管理自己创建的 SSH 进程。

新建远程工作区时，输入框通过所属机器的官方 `directoryPicker/list` 查询目录候选，支持点击、方向键、Enter 和 Tab 补全。`~/` 与相对路径按远端账号主目录展开，提交已有目录给官方工作区接口；文件不出现在候选中，输入 `.` 前缀可查找隐藏目录。关闭窗口会取消尚未完成的目录查询。

目录区域和提示区域保持固定高度，切换时保留现有列表直到新结果返回。窗口内最多缓存 32 个目录，每项有效 15 秒；返回刚访问过的目录和筛选同一目录下的名称会复用列表。快速查询不显示加载文字，超过 250 毫秒才提示正在读取。

DSH 连接信息保存在 `$DSH_HOME/remote-hosts.json`，文件权限为 `0600`。管理接口不返回 token。SSH 密码只通过单次 SSH_ASKPASS 请求传给 OpenSSH。准备脚本检查 PATH、NVM、插件安装目录，以及 Linux 上同一用户、相同 HOME 的官方 DSH 进程，识别自定义安装目录和 DSH_HOME。已有 Web 服务直接通过 SSH 连接原端口，保留原进程、模型配置及会话；从插件保存的服务状态或进程的普通日志文件取得的认证信息会先验证。无法取得认证信息时，界面要求粘贴服务启动时显示的完整 URL；该地址只接受 loopback HTTP，连接成功后保存，下次直接复用。多个服务且没有已保存的服务信息时，通过该 URL 明确连接目标。

已有 DSH `0.2.2-rc.1`、`0.2.2-rc.3` 可复用；检测到其他版本时明确报错，保持已有安装。已有运行服务不触发 Node.js 升级。需要启动服务时要求 Node.js ≥`24.9.0`，启动已有 DSH 不要求 npm。仅缺少 DSH 或启动所需的 Node.js 时显示安装确认：官方 DSH `0.2.2-rc.1`、Node.js `24.20.0` 和自带 npm 按需安装到 `~/.local/share/dsh-remote-hosts`。新安装使用 `DSH_HOME` 或默认 `~/.dsh`；系统已有安装保留。

## 实现

`lib/gateway.js` 监听 `127.0.0.1`，默认由系统分配空闲端口，通过 `ssh -N -L` 连接远端。Host 通过官方 `webserver/index-inject` 启动配置向客户端发布实际地址。token 在 gateway 内换成认证 cookie；HTTP 和 WebSocket 代理共用机器的认证状态。HTTP 401/403 会触发一次重新认证。来源仅允许 loopback 页面和 `dsh-app://app`。

`client/source.js` 负责侧栏和远端状态；`client/native-adapter.js` 管理原生会话、权限和模型服务适配，`client/lifetime.js` 管理方法包装及释放，`client/slot-adapter.js` 管理指定插槽的订阅和组件包装，`client/compatibility.js` 检查宿主版本与能力。`client/transport.js` 为每台机器创建独立 HTTP/WS 传输、权限状态和 RPC 映射。根 Remote 接口中仅包装明确列出的 28 个，根据协议声明的身份字段分发请求。会话身份为 `remote:<hostId>:<sessionId>`；普通标题、命令文字、用户消息和文件内容保持原值，`sessions.scopeOf` 直接使用官方实现。

插件构建复用官方 `Session`、`RemoteStream`、`RemoteStreamMuxClient` 和权限状态实现。原生 React 组件消费官方 Session 对象的事件、投影、发送回显和状态。历史、流式、分页、停止、队列和 slash command 使用官方数据层。模型目录、远程权限和空会话的工作区来源按机器分开。

远程工作区的“新建会话”直接进入原生新会话页面，工作区、Agent 菜单、模型菜单和输入框使用原生组件。创建通过 `uiWorkspace.startSession` 和原生导航执行，远端空白会话复用、并发创建合并及草稿初始化按目标工作区处理。`client/remote-agent-presets.js` 为原生 Agent 组件提供远端可用预设、开发工具设置及选择接口；`client/remote-workspace-picker.js` 为原生工作区菜单提供当前机器的工作区列表和创建操作。远端目录使用 SSH 路径候选窗口选择。会话开始后，原生标题区域继续显示远端 Agent 名称。

菜单适配使用官方单插槽订阅，根据受支持版本的组件名称、locale 和必要的 `options.id` 识别目标。其他菜单组件保留自己的注入函数，目标注册移除时立即释放其包装。

构建产物仅包含本插件代码及所用的官方数据层；安装的 DSH 文件不被修改。

## 侧栏注入与兼容

原生侧栏目前没有可追加机器组的扩展入口。插件通过 `compatibility.js` 中的 `_sidebarCol`、`[role="tree"]`、`_groupSection` 和 `[data-row-key^="session:"]` 等锚点定位原生结构，复用原生行的样式，在全部本地分组后插入带 `data-dsh-remote-hosts` 标记的节点。本地来源过滤远程身份，远程节点位于原生动画列表外；本地与远端分别维护选择及折叠状态。

MutationObserver 观察侧栏内部和外层容器的直接子节点，原生结构重新挂载时恢复插件节点。稳定数据比较跳过无变化的刷新；变化的机器分组通过 morphdom 按会话身份更新，保留现有节点和焦点。会话列表订阅驱动远程摘要同步。聊天使用原生 conversation；版本或必要接口不兼容时明确报错，初始化失败时释放已经安装的适配。

远程侧栏订阅宿主 `uiSession.sessionStatus`，复用原生 `StateDot` 显示运行转圈、等待回复／审批的黄点及后台完成提醒。待交互时显示“待回复／待审批／待确认”，处理后恢复时间；打开已完成会话后，由原生状态服务清除完成未读。状态组件随对应行移除或插件停用释放。

注入行支持机器折叠、工作区折叠、点击打开和创建操作；原生树的完整键盘导航、右键菜单和拖拽尚未接入。

本地列表按内容高度排列，与 SSH 工作区共用滚动区域；折叠本地分组后，SSH 分组紧跟本地内容。停用插件时恢复原生列表滚动样式。

原生会话适配还使用 `sessions` 的运行时包装、`uiSession` 的会话来源、模型目录对象和空来源生成方法。这些兼容点依赖上游内部结构，升级必须重新验证，详见 [B-INTEGRATION.md](./B-INTEGRATION.md)。本机版本通过 `engines.dsh`、客户端版本列表和能力检查限制；远端已有服务目前未做完整版本协商，不会自动升级已有环境。远端自动安装版本固定为 `0.2.2-rc.1`。

## 构建与测试

```sh
git clone https://github.com/Castleeee/dsh-remote-hosts.git
cd dsh-remote-hosts
npm ci --legacy-peer-deps --ignore-scripts
npm run build
npm test
npm run pack:release
```

本地构建需要 Node.js ≥`24.9.0` 和 OpenSSH。`dist-pack/` 中生成安装包、`SHA256SUMS` 和发布说明；`npm pack` 也会先构建客户端。运行依赖由安装时的包管理器安装。

GitHub Action 在推送 `main` 或手动运行时检查、构建并发布当前 `package.json` 版本。每次发布重新生成同版本 Release，安装地址保持稳定；修改版本号后生成对应新版本。PR 运行检查并保留构建附件。Action 中的基础测试不包含需要真实 SSH、浏览器及模型凭据的集成验收，发布前仍需按下方说明验证涉及的功能。

浏览器验收使用真实官方 DSH、真实 SSH 和两个独立的远端 `DSH_HOME`，不会生成模拟事件：

```sh
DSH_LAB_URL='<lab 登录地址>' DSH_TEST_HOSTS='jack,jack-isolation' npm run test:integration
```

Chrome 路径可通过 `CHROME_PATH` 指定。`DSH_HISTORY_SESSION` 可指定第一台机器上一段真实历史，验证小窗口分页及已有图片回读。登录地址包含 token，避免写入共享日志或命令历史。

`npm test` 验证真实 HTTP/WS 来源限制、非法机器参数、占用端口、配置持久化和进程归属；`test:integration` 验证原生空会话输入框、模型目录隔离、命令、取消请求、附件上传、本地回归、引用释放及禁用/重新启用。

`test:sidebar` 验证原生行的字号、尺寸、水平位置、折叠、选择、本地消息及远程切换；`test:hosts` 验证真实配置列表、单命令输入与 SSH 连接。`test:password` 在测试机创建专用用户及独立 loopback sshd，验证主机指纹、错误密码重试、真实 DSH 转发和取消，结束后清理专用用户与服务。

`test:sidebar-status` 使用真实远端模型、前台命令、问题和审批，验证动画转圈、后台完成提醒、打开后的已读清除、待回复／审批黄点、会话切换及处理后恢复，并检查停用清理。

`test:paths` 在真实 SSH 测试机创建专用目录，通过原生网页验证远端目录候选、文件过滤、隐藏目录、软链接、中文与空格路径、键盘补全、无效路径提示和 `~/` 展开后的实际工作区创建，结束后删除测试工作区与专用目录。

`test:new-session` 使用真实 SSH 目录，通过侧栏按钮进入原生新会话界面，验证连续点击、空白会话复用、草稿保留、远端 Agent 切换和模型菜单、原生工作区菜单中的目录选择与创建、工作区切换时传递草稿、本地新会话回归及真实模型回复，最后清理专用会话和工作区。

`test:ssh` 使用 `DSH_TEST_REMOTE_TOKEN`、`DSH_TEST_SSH_ALIAS` 和 `DSH_TEST_REMOTE_PORT` 连接真实远端，验证隧道替换、token 留空保留、认证失败和更新恢复，以及移除/停止后的端口释放。测试 token 通过环境传入，不输出到日志。

设置 `DSH_TEST_PROMPT=1` 可通过原生输入框发送一条测试消息；同时设置 `DSH_EXPECT_MODEL_SUCCESS=1` 时要求远端模型成功完成。凭据不可用时的失败返回不能作为成功回复验收。

`npm run test:interactions` 使用 `DSH_LAB_URL`、`DSH_TEST_HOST`（默认 `jack`）和 `DSH_TEST_SSH_ALIAS`（默认 `root@jack-dirty-linux`）。远端工作区为 `/root/dsh-test`，需要可用模型以及 bash、ask_user_question 工具。测试通过原生界面发送消息、停止运行、编辑/删除/插话发送队列消息、回答和取消问题、允许与拒绝审批；通过 SSH 核对审批对应文件并清理，最后归档专用测试会话。

`npm run test:reconnect` 另需 `DSH_TEST_TUNNEL_PID`，必须指定本次 gateway 创建的 SSH 转发进程。测试终止这个隧道，验证自动重建、投影恢复、保留的会话绑定、历史事件去重与 scoped RPC。`DSH_HISTORY_SESSION` 可加入既有真实历史的保留与去重检查。

## 禁用与维护

插件禁用时清除注入节点、观察器、定时器和远程列表行，先移除 UI 来源，再恢复被包装的方法，关闭远程流和会话作用域；Host 插件停止 gateway 与自身 SSH 进程。方法恢复检查当前属性的归属，保留其他插件随后添加的包装；其他插件持有的旧包装在停用后直接转交原方法。机器配置文件保留。

`gatewayPort: 0` 使用系统分配的端口；也可以指定独立的固定端口。不同 profile 应分别使用自己的 `DSH_HOME`、机器配置和 SSH 转发端口。浏览器验收可通过 `window.__DSH_REMOTE_HOSTS__.snapshot().gateway` 取得当前地址，并设置 `DSH_GATEWAY_URL`。

`npm run test:compatibility` 验证真实宿主上的 28 个根 RPC 包装、原生 scopeOf、普通 `remote:` 前缀文字的本地请求、方法恢复、其他插件同时包装服务及注册菜单、组件卸载恢复、初始化中途失败清理，以及轮询和真实改名后的节点与焦点保留。

`npm run test:installation` 在真实 SSH 机器创建专用用户和独立 sshd，验证检查环境、安装提示、拒绝、确认前关闭窗口、过期确认、后台安装与重新打开、取消实际下载进程，以及 Node.js 与 DSH 安装和真实连接，最后清理专用环境。

`DSH_TEST_HOSTS_FILE='<已有服务的机器配置文件>' npm run test:runtime` 检查真实非交互 SSH 中的自定义安装与运行服务发现，验证认证地址输入、原端口和进程复用、真实会话查询、后续直接连接以及管理响应不含凭据。`DSH_TEST_SSH_ALIAS` 默认为 `jack-dirty-linux`。测试配置文件包含敏感凭据，请勿提交。

后台安装由本地 DSH Host 管理。关闭管理窗口或浏览器后继续执行；停止本地 DSH、禁用 Host 插件或点击取消会停止准备任务。取消时清理本次安装目录，已完整安装的运行环境保留供再次连接使用。

专项验证已有环境时，设置 `DSH_TEST_EXISTING_NODE` 为远端真实 Node.js 安装目录，`DSH_TEST_EXISTING_APP` 为远端已安装的官方 DSH 目录（默认 `/root/dsh-test/app`）。测试复制实际安装到专用用户，检查已有环境直接连接、服务工作目录、缺少 DSH 时的安装提示与拒绝、关闭窗口和浏览器页面后的实际 npm 安装进度恢复与取消。该方式不验证完整下载完成。`DSH_TEST_SSHD_PORT` 可指定专用 sshd 端口，默认 `18084`。

升级 DSH 时，在独立 lab 安装相同版本，核对官方数据层路径、RPC 描述符、会话作用域、模型目录及侧栏锚点，然后运行全部验收。通过后再更新依赖版本和构建产物。远程文件的本地打开行为、子代理完整路由、远端服务重启与活动流式期间的恢复仍在 [ROADMAP.md](./ROADMAP.md) 的验收清单中。

安装与卸载见 [INSTALL.md](./INSTALL.md)，产品约束见 [PROJECT.md](./PROJECT.md)。

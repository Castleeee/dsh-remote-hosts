# 原生会话适配

本机适配版本为 DSH `0.2.2-rc.1`、`0.2.2-rc.3`，构建数据层和远端自动安装版本为 `0.2.2-rc.1`。仅修改插件自身源码及构建产物。

## 官方数据层

`build.mjs` 从固定版本依赖中打包官方 `Session`、`RemoteStream`、`RemoteStreamMuxClient`、`ClientAccessState` 和 `whenAllowed`。`createScope` 使用 DSH 已加载的官方 Session Controller 模块，以共用作用域 Symbol；作用域身份直接由原生 `sessions.scopeOf` 读取。`cordis` 和客户端 store 也由 DSH 提供。

`Session` 负责历史窗口、`loadOlder/loadThrough`、assistant-stream、持久消息交接、发送回显、运行状态、队列、命令和附件读取。插件不折叠聊天领域事件。`session/control` 的完整投影与增量写入官方投影 store。

## 传输与身份

每台机器独立持有 WebSocket mux、HTTP 请求、连接代数和权限状态。RPC 参数依据 `ctx.typert.remotes` 的官方描述符生成，包含 scoped API 的隐含 Agent 身份和取消信号。身份仅在协议的身份字段转换；跨机器身份被拒绝。

本地会话身份保留原值，远程身份为 `remote:<hostId>:<rawId>`。`sessions` 包装根据身份分发 `retain/using/retainInfo/binding/scope/sessionOf/retainAgentScope`，原有本地方法继续执行原生行为。`sessions.scopeOf` 使用官方实现，读取远端官方作用域携带的身份。

首次准备远端时，`bootstrap.sh probe` 通过 SSH 只读检测 DSH 与 Node.js；缺少环境时，SSH 管理器等待一次安装确认。确认内容包括 DSH `0.2.2-rc.1` 与按需安装的 Node.js `24.20.0`；已有符合要求的 Node.js 和 NVM 安装直接复用。`prepare` 仅允许安装本次已确认的内容；确认前拒绝或关闭窗口终止连接。确认后操作由 Host 持有，管理窗口发送 `dismiss` 时保留后台任务；重新打开读取已有操作，恢复安装进度和取消按钮。

准备步骤通过 `bootstrap-runner.sh` 执行，SSH 标准输入作为控制通道。取消或 Host 停止时关闭控制通道，远端监督进程停止本次准备进程及其子进程并清理对应安装目录；任务完成时释放监督进程。完整的 Node.js 和 DSH 安装移动到正式目录后才启动服务和建立连接。

每个远程 Session 持有官方作用域，`binding.ctx.remote` 和 `remoteAccess` 对应远端。引用计数按来源保存；释放幂等，最后一个引用离开后关闭会话和作用域。`binding` 和 `scope` 仅借用已有实例，`using` 等待 `ready`。

## 原生界面来源

- `sessions.list` 添加远程摘要，`retainedBy.mainView` 驱动原生中心区域。
- 原生 sidebar.workspaces 的 inject 来源仅过滤远程摘要，保留原组件、工作区来源、动作、子插槽及持久状态；远程 DOM 追加在原生动画列表外。
- `uiWorkspace.openSession` 打开远程身份；原生 React 使用稳定的 SessionBinding。
- `uiSession.provide` 提供该机器的工作区快照，使新建远程空会话的工作区标签和 composer 可用。没有选中会话时保留 root 工作区来源。
- 每台机器复用官方模型 catalog 类；通过宿主公开导出的 ModelDirectory 构造远程目录，目录随会话作用域释放，模型投影来自远端。
- 远程新建入口调用原生 `uiWorkspace.startSession`；`connectBlank` 按远程工作区身份连接并合并同时发生的创建请求。原生 `openWorkspace` 保留导航取消、失败通知、主视图引用和草稿初始化。未指定工作区的新建操作沿用当前远端工作区。
- 原生 Agent 插槽按会话身份提供远端 roster、开发工具设置、选择及错误状态；会话摘要保留完整投影，供原生 Agent 名称与空白会话匹配使用。原生工作区菜单订阅当前机器的工作区来源；目录浏览与工作区创建通过对应机器执行。
- 全局 Remote 仅包装明确列出的 28 个会话、工作区及命令接口。`remoteInvocationIdentity` 根据官方描述符的参数 wire 名称检查直接身份参数、request 中的身份字段及 address.sessionId，目标为远程身份时分发到远端；普通标题和命令文字不参与身份判断。根模型目录、查询文字及全局配置接口保持原生来源。审批和问题 waterfall 通过对应会话的实际 Context 派发，结果通过该机器的 `$events/result` 返回。
- 远端权限来自真实 `remoteAccess/follow`，资源检查和 effect guard 根据机器选择权限来源。
- 远程侧栏订阅公开 `uiSession.sessionStatus`，运行、最高优先级待交互和完成未读由宿主统一管理。`client/sidebar-status.js` 使用宿主 React 和原生 `StateDot` 渲染状态；侧栏更新保留组件容器，行移除和停用时卸载。
- 上传使用目标机器的 `session/uploadFileBinary`；历史图片通过官方 `Session.readAttachment` 回读。

`client/slot-adapter.js` 通过官方 `slots.subscribe(name, listener)` 订阅各自插槽，包装目标组件的 `StoredEntry.inject`。Agent 入口匹配 `AgentPresetSeat` 及对应 locale，标题菜单还要求 `options.id === 'agent-preset'` 和 `AgentPresetLabel`；工作区匹配 `WorkspacePicker`、`NativeDirectoryFlow/BrowseDirectoryFlow`，本地侧栏匹配 `WorkspaceBrowser`。组件名称取自受支持的 DSH 版本。插槽注册移除时立即释放对应包装，停用时取消订阅并释放全部包装。

## 兼容点

以下内部结构需要在升级时核对：

| 位置 | 依赖 |
|---|---|
| `build.mjs` | 官方包 `lib/types/client` 中的数据层模块路径 |
| `client/transport.js` | Typert 描述符参数、scope、mode、cancellation 结构和 mux 协议 |
| `client/native-adapter.js` | Session Controller 方法、UI 来源及允许路由的 Remote 接口 |
| `client/source.js` | 会话列表结构、createScope 身份 |
| 模型适配 | ModelDirectoryResolver.catalog 的构造类、directoryFor、公开的 ModelDirectory 构造接口 |
| 工作区适配 | uiSession.materializeAbsent、会话工作区来源覆盖、uiWorkspace.mainReference/clearMain/startSession/connectBlank |
| 插槽生命周期 | slots.subscribe/entries、StoredEntry.inject、component.name、locale 和 options.id 元数据 |
| 新会话菜单 | conversation.hero.agentPreset 的 AgentPresetSeat、conversation.session.header.actions 的 AgentPresetLabel、conversation.hero.workspace 的 WorkspacePicker，以及 directoryFlow 的 NativeDirectoryFlow/BrowseDirectoryFlow |
| 侧栏 | 工作区树 DOM 锚点、CSS 类名片段、sidebar.workspaces 的 WorkspaceBrowser 与 StoredEntry.inject |

构建检查官方内部依赖的版本；插件包的 `engines.dsh` 声明支持的本机版本，客户端启用前检查 DSH release 和必要能力。`supportedVersion` 指定构建数据层版本，`supportedHostVersions` 指定验收过的本机版本。远端已有服务目前没有完整版本协商，连接不会自动升级已有环境；自动安装固定版本也不能代替对已有远端服务的版本检查。

插件停止时，先退出远程主会话、移除会话来源，再按归属恢复原方法的属性描述符，释放流、Context 和临时列表行。其他插件后来添加的包装得到保留；旧包装失效后直接调用原方法。初始化中途失败使用同一清理流程。机器配置保留。

## 验收边界

完整测试记录见 [PROGRESS.md](./PROGRESS.md)。成功回复、流式结算、运行中停止、队列编辑/移除/steer、审批允许/拒绝、问题回答与取消均已通过真实远端验收。问题取消使用官方 `projectRemoteEventRejection` 保留 `UserQuestionError` 和 `ASK_CANCELLED`。SSH 隧道真实中断后，会话绑定保留、投影恢复、历史去重与 scoped RPC 通过。小窗口历史分页在真实旧会话验证；默认窗口的长历史跳转仍需足够长的真实会话。远端文件动作、子代理、服务重启及活动流式期间恢复仍需验收。

# 安装与卸载

当前仅在独立 lab 中启用。日常 Desktop 安装应在 [ROADMAP.md](./ROADMAP.md) 中的关键行为验收通过后执行。

## 安装发布包

要求本地 DSH `0.2.2-rc.1`、Node.js ≥`24.9.0` 和系统 OpenSSH。在 DSH 插件管理界面添加：

```text
https://github.com/Castleeee/dsh-remote-hosts/releases/download/v0.0.1/dsh-remote-hosts-0.0.1.tgz
```

也可以在 [Releases](https://github.com/Castleeee/dsh-remote-hosts/releases) 下载 `.tgz` 文件和 `SHA256SUMS`，核对校验值后安装本地文件。安装包包含已构建的客户端，运行依赖由包管理器安装。Desktop profile 通过桌面应用的插件管理界面操作。

`master` 每次推送会运行基础测试、构建并发布当前版本；同版本 Release 更新到最新提交。集成测试覆盖情况和剩余限制见 [PROGRESS.md](./PROGRESS.md)。

## 从源码构建

```sh
git clone https://github.com/Castleeee/dsh-remote-hosts.git
cd dsh-remote-hosts
npm ci --legacy-peer-deps --ignore-scripts
npm test
npm run pack:release
```

插件包中的 `client/client.js` 是构建产物。修改客户端源码后重新构建；安装 `dist-pack/dsh-remote-hosts-0.0.1.tgz`。`SHA256SUMS` 和对应发布说明也保存在该目录。

## 安装到目标 profile

发布包安装完成后，通过官方 bundle 安装流程注册 Host 插件及 Client 插件。开发时也可以在目标 DSH 的插件管理界面添加本地源码目录：

```text
link:/absolute/path/to/dsh-remote-hosts
```

开发目录的依赖版本需要与 Host 相符，升级 DSH 后先核对 [B-INTEGRATION.md](./B-INTEGRATION.md) 中的兼容接口。重启目标 profile 后，应出现“机器管理”。默认 gateway 端口由系统分配；客户端调试接口 `window.__DSH_REMOTE_HOSTS__.snapshot().gateway` 返回实际地址，其 `/status` 应返回 `running:true`。

不同 profile 分别使用自己的 `DSH_HOME` 和机器配置。机器的本地转发端口必须空闲；指定固定 gateway 端口时，各 profile 应使用不同端口。

机器管理直接读取 `~/.ssh/config`，选择机器即可连接。添加新机器输入 `ssh root@host -p 22` 或 `root@host -p22`。密码、密钥口令和指纹确认按实际 SSH 请求显示。远端缺少 DSH 或合适运行环境时，先显示安装确认：DSH `0.2.2-rc.1`，以及按需补装的 Node.js `24.20.0`（含 npm）。已有 Node.js ≥`24.9.0` 直接复用。确认前只检查环境；确认前拒绝或关闭窗口后不安装、不建立 DSH 连接。确认后显示“安装中…”和取消安装的 `×` 按钮，关闭管理窗口或浏览器仍会继续安装；重新打开可恢复查看和取消。后台执行需要保持本地 DSH 运行。端口与 DSH 认证信息自动取得。远端模型凭据在远端 DSH 中配置。

## 安装异常

保留官方插件管理器返回的准确错误。依赖锁文件发生错误时，先备份该 profile 的 `package.json`、锁文件与配置，再使用其包管理器处理。不要直接编辑锁文件。安装失败的原因以当前执行结果为准。

## 禁用或卸载

通过官方插件管理器禁用或移除 `dsh-remote-hosts` bundle，重启目标 profile。gateway 与插件创建的 SSH 进程应停止，机器分组应消失，本地会话可继续使用。

机器配置保留在 `$DSH_HOME/remote-hosts.json`；需要删除保存的机器与 token 时，可以删除这个文件。远端 DSH 的会话和凭据不受卸载影响。

## 验证

- 机器管理与 VS Code 共用配置；可读取列表、添加 SSH 命令、连接和取消认证。
- 展开机器后显示真实远程工作区和会话。
- 新建远程会话出现可输入的原生 composer，模型目录对应远端。
- 本地与远端切换正常，审批、停止、队列、附件分别到达对应机器。
- 禁用后端口释放，没有插件创建的 SSH 进程残留。

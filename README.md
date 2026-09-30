# FerryLink

> ⚠️ **升级前请先卸载旧版**：如果你此前安装过「网盘直链下载助手」或本脚本的旧版本
> （`@namespace` 为 `https://github.com/Wjavan/Direct-download-link`），请在脚本管理器中
> **先卸载它**，再安装 FerryLink。两者 `@name` 不同但 namespace 相同，部分管理器会并存
> 两份脚本，导致网盘页面上出现两个「下载助手」按钮、点击后命令重复执行。

网盘直链下载助手 · 支持 百度 / 阿里 / 天翼 / 迅雷 / 夸克 / 移动 六大专有网盘。
在网盘页面注入按钮 → 调用网盘官方 API 换取文件直链 → 推送到本地下载器。

---

## 致谢与来源

本项目是派生项目，基于以下上游修改而来：

- **上游项目**：油小猴（youxiaohou.com）的「网盘直链下载助手」
  （原始仓库：https://github.com/Wjavan/Direct-download-link）
- **原作者**：`Wjavan` 及上游所有贡献者
- **本项目修改内容**：
  - 移除全部「分享页（他人分享链接）」功能
  - 修复阿里云盘网格（grid）视图下无法读取选中文件的问题
  - 修复取链签名函数（`getSign` / `getRandomString`）作用域错误导致天翼与移动云盘崩溃
  - 安全加固：RPC 主机白名单、文件名净化、直链协议校验、Token 迁入 GM 存储沙箱
  - 隐私加固：导出命令不再携带完整 Cookie 会话
  - 移除死代码，新增一次性配置迁移与 CDN 失败降级提示

原作者署名与原始项目链接按许可证要求完整保留。

## 许可证

本项目采用 **GPL-3.0**，完整文本见 [LICENSE](./LICENSE)。

> **待确认**：本项目声明的 `@license GPL-3.0` 沿用自原脚本元数据。若上游「油小猴网盘直链下载助手」
> 实际采用 AGPL-3.0，则需将本项目升级为 AGPL-3.0（升级合法，降级不合法）。请维护者核对上游
> LICENSE 文件后确认。

### 第三方依赖

| 依赖 | 版本 | 许可证 | 兼容性 |
|------|------|--------|--------|
| [jQuery](https://jquery.com/) | 3.7.0 | MIT | 与 GPL-3.0 兼容 |
| [SweetAlert2](https://sweetalert2.com/) | 10.16.6 | MIT | 与 GPL-3.0 兼容 |
| [js-md5](https://github.com/emn178/js-md5) | 0.7.3 | MIT | 与 GPL-3.0 兼容 |

三个依赖通过 `@require` 从 unpkg CDN 加载，版权归各自作者所有。
若 CDN 不可达，脚本会显示明确提示横幅而非静默崩溃。

本项目为**纯本地运行，无自有服务端**，不收集任何遥测或统计数据。
除上述 CDN 外，所有网络请求仅发往各网盘官方域名及用户自行配置的本地 RPC 地址。

分发形式为**未混淆的可读源码**，符合 GPL-3.0 源码可得性要求。

---

## 最低环境要求

### 浏览器与脚本管理器

| 项 | 最低要求 |
|----|---------|
| 浏览器 | Chrome / Edge 100+，或 Firefox 100+ |
| 脚本管理器 | Tampermonkey 4.18+（推荐） |

**关于 Violentmonkey / Greasemonkey**：本脚本通过 `GM_cookie` 读取百度网盘的 `BDUSS` Cookie，
该 API 为 Tampermonkey 独有。在 Violentmonkey / Greasemonkey 下：
- 阿里 / 天翼 / 迅雷 / 夸克 / 移动：**功能完整**
- 百度：BDUSS 读取降级，**Aria / cURL / BC 导出的命令不带 Cookie，直链下载会返回 403**。
  百度请改用「直接下载」或「增强下载（文件流）」。

### 下载器（仅在使用对应方式时需要）

| 方式 | 前置条件 |
|------|---------|
| API 下载 → 直接下载 | 无（浏览器内置） |
| API 下载 → 增强下载（文件流） | 无（浏览器内置，文件需 ≤1GB 且支持 Range） |
| Aria 下载 | 自行安装 aria2，命令粘贴到终端执行 |
| cURL 下载 | 系统已安装 curl |
| BC 下载 | 自行安装比特彗星 |
| RPC 下载 | aria2 / Motrix 已启动并开启 RPC，见下 |

### RPC 服务开启方式

aria2（默认端口与本脚本默认值一致，端口 16800 为 Motrix 默认）：

```bash
# aria2 默认 RPC 端口为 6800；Motrix 默认 16800
aria2c --enable-rpc --rpc-listen-all --rpc-listen-port=6800 --rpc-secret=YOUR_SECRET
```

在脚本「设置」中填入：

| 配置项 | 填写内容 |
|--------|---------|
| RPC 主机 | `http://localhost`（仅允许本机或内网地址） |
| RPC 端口 | aria2 为 `6800`，Motrix 为 `16800` |
| RPC 路径 | `/jsonrpc` |
| RPC 密钥 | 上面 `--rpc-secret` 设置的值；未设则留空 |
| 保存路径 | 留空则使用 aria2 自身配置的下载目录 |

> RPC 主机受白名单限制，仅接受 `localhost` / `127.0.0.1` / `10.x` / `172.16-31.x` /
> `192.168.x` / `169.254.x`。云端 aria2、Tailscale、ZeroTier 等远程地址**不被支持**。

### 网络要求

- 需能访问各网盘官方域名
- 需能访问 `unpkg.com`（CDN 依赖）。若不可达，脚本会显示降级提示横幅
- 无需代理

### 权限说明

| 权限 | 用途 |
|------|------|
| `GM_xmlhttpRequest` | 跨域调用网盘 API 与本地 RPC |
| `GM_setClipboard` | 复制下载链接与命令 |
| `GM_getValue` / `GM_setValue` / `GM_deleteValue` | 保存 RPC 配置与登录态 |
| `GM_registerMenuCommand` | 右键菜单「设置」入口 |
| `GM_cookie` | 读取百度 `BDUSS`（仅百度需要） |
| `window.close` | 百度 OAuth 授权完成后关闭授权窗口 |

---

## 功能

- 个人主页 / 文件夹页：勾选文件 → 一键获取直链
- 6 种下载方式：API（直接下载 / 增强文件流）、Aria2、cURL、RPC（aria2/Motrix）、比特彗星、IDM（浏览器集成）
- 多文件批量选择与批量推送
- 分片并发下载（增强下载），6 线程，带完整性校验
- RPC 主机白名单与文件名净化，防止路径穿越
- 深链弹出、链接一键复制
- 主题色自定义

**不支持**：他人分享链接页（v1.3.0 起移除）。

## 安装

1. 安装 Tampermonkey
2. 将 `netdisk-download-helper-v1.1.4.user.js` 拖入浏览器窗口，或在 Tampermonkey 中新建脚本并粘贴
3. 打开网盘页面，右上角出现「下载助手」按钮

## 常见问题

**按钮没出现？**
检查 F12 Console。红色 `Refused to connect` 说明 `@connect` 域名未覆盖（应已完整）；
顶部红色横幅说明 CDN 依赖加载失败，检查网络。

**提示「无法连接 RPC」？**
aria2 未启动，或端口/路径/密钥填写错误。错误信息中会标明实际尝试的地址与端口。

**提示「请先勾选要下载的文件」但确实已勾选？**
网盘可能改版。选择器失效属于已知风险（依赖网盘内部 DOM 结构），
请附页面截图与 Console 信息反馈。

## 免责声明

本项目仅供个人学习与本地下载加速使用。使用者需自行遵守各网盘服务条款，
自行承担因使用本工具产生的一切后果。

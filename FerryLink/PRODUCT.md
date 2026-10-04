# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (userscript: Tampermonkey / Greasemonkey, run-at document-idle)

## Stack

Userscript. jQuery 3.7.0 + SweetAlert2 10.16.6 + js-md5 0.7.3, all `@require`d from unpkg. No build step, no framework, no backend. Single file: `网盘直链下载助手.user.js`.

## Users

- 用下载管理器（IDM / Aria2 / XDown / Motrix）的国内网盘重度用户，要直链、要带 UA / Cookie 推送
- 想绕过官方客户端限速的普通网盘用户
- 作者自用，顺便开源

## Product Purpose

在百度、阿里、天翼、迅雷、夸克、移动六大网盘页面注入直链下载入口，让用户绕过官方客户端，用自己选择的下载方式（浏览器 / IDM / Aria2 / cURL / BitComet / RPC）取文件。存在的意义是给用户选择权，不是替用户决定怎么下。

## Positioning

油小猴（youxiaohou.com）网盘直链下载助手的 fork。相对上游的差异：IDM capture 协议直推（绕过浏览器扩展拦截）、六网盘统一支持、百度 OAuth + BDUSS 双通道、移除分享页、界面重排与 bug 修复。定位是上游的一个更激进的维护分支，不是重新发明。

## Operating Context

用户已登录网盘网页版。脚本在 `document-idle` 注入，读取页面登录态（cookie / localStorage / GM 存储）拼直链。百度需 OAuth 授权（`openapi.baidu.com` 流程）+ BDUSS；阿里需 access_token + 浏览器 UA；迅雷 / 夸克需 `__pus` / `__puus` cookie；天翼 / 移动无特殊头。IDM 通过 `127.0.0.1:1001` capture 协议推送，Aria2 通过 JSON-RPC，cURL / aria2c / bc 通过复制命令文本。

## Capabilities and Constraints

- 六网盘 API 直链获取（百度 OAuth + BDUSS，阿里 OAuth refresh，天翼 MD5 签名，迅雷 / 夸克 / 移动凭 cookie）
- 下载方式：浏览器 iframe、IDM capture（带 UA + 文件大小 + Cookie）、Aria2 JSON-RPC（SSRF 白名单限本机 / 内网）、cURL / aria2c / BitComet 命令复制
- 百度 API 浏览器下载 50MB 维护门槛（其他五家不限），超过提示改用 IDM / Aria2 / cURL
- 设置弹窗穿透微前端遮挡（`target: document.body` + `didOpen` + z-index 2147483647）
- `history.go(0)` 保存后刷新
- 分享页功能已移除，不恢复

## Brand Commitments

- 名称：FerryLink
- 作者：Wjavan
- 许可：GPL-3.0（保留上游署名）
- `@namespace`：`https://github.com/Wjavan/FerryLink`
- `@updateURL` / `@downloadURL`：GreasyFork 595544
- `GM_cookie` 权限保留
- BDUSS 导出保留完整值，不加 UI 警示
- 图标用内联 SVG / data URI，不引外部 CDN 字体 / 图标库
- 不用 Shadow DOM（破坏 document 级事件委托）

## Evidence on Hand

- `网盘直链下载助手.user.js` — 3228 行，当前版本 1.2.2
- `README.md` — 功能、许可、安装说明
- `LICENSE` — GPL-3.0 全文
- `RELEASE_NOTES.md` — 1.2.0 修复批次说明
- GreasyFork 595544 已发布旧版，新版待手动上传
- GitHub 仓库：`https://github.com/Wjavan/FerryLink`

## Product Principles

1. **用户选择权优先**：提供多种下载方式，不替用户决定，普通链接不主动调用 IDM
2. **最小差异维护**：复用上游正确逻辑，拒绝过度工程，修 bug 不重写
3. **诚实提示**：不编造官方未公布的限速数值，维护侧门槛标注为维护侧
4. **凭据不外泄**：敏感数据走 GM 沙箱存储，localStorage 只留 alipan 自己页面必须读的 token
5. **不破坏原页面**：只注入按钮和事件，不改网盘页面结构，不做去广告

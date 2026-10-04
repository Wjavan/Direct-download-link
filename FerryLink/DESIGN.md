---
name: FerryLink
description: 六大网盘直链下载助手，注入式 UI 覆盖层
colors:
  brand-default: "#09AAFF"
  brand-baidu: "#09AAFF"
  brand-ali: "#637dff"
  brand-tianyi: "#2b89ea"
  brand-xunlei: "#3f85ff"
  brand-quark: "#ffffff"
  brand-yidong: "#3181f9"
  text-primary: "#111"
  text-secondary: "#606266"
  text-tertiary: "#909399"
  border-default: "#e6e8eb"
  bg-canvas: "#fff"
  bg-subtle: "#f5f6f7"
  state-success: "#55af28"
  state-danger: "#cc3235"
  state-warning: "#da9328"
  state-info: "#606266"
typography:
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.brand-default}"
    textColor: "#fff"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#0073e3"
  button-danger:
    backgroundColor: "{colors.state-danger}"
    textColor: "#fff"
    rounded: "{rounded.md}"
  button-success:
    backgroundColor: "{colors.state-success}"
    textColor: "#fff"
    rounded: "{rounded.md}"
  button-warning:
    backgroundColor: "transparent"
    textColor: "{colors.state-warning}"
    rounded: "{rounded.md}"
  button-info:
    backgroundColor: "{colors.state-info}"
    textColor: "#fff"
    rounded: "{rounded.md}"
---

# Design System: FerryLink

## Overview

FerryLink 是注入式 UI 覆盖层，不是独立应用。它的视觉系统有两个面孔：对外，每个网盘的入口按钮贴近该网盘官网品牌色（百度蓝、阿里紫蓝、天翼蓝、迅雷蓝、夸克白底、移动蓝）；对内，API 下载弹窗、设置弹窗和所有操作按钮用一套自洽的内部系统（`pl-*` 类名），与网盘页面隔离。

整体气质是「中性工具」——不抢戏，不装饰，密度紧凑，按钮和链接一眼能分清主次。字体走系统栈，圆角 4-8px，阴影极淡（4-8% 不透明度），不引外部资源。

**Key Characteristics:**
- 双层身份：外层贴品牌，内层自洽隔离
- 系统字体栈，无外部字体依赖
- 极淡阴影（rgb(28 28 32 / 4-8%)），近扁平
- 4-8px 圆角，紧凑间距
- 状态色语义化：success 绿、danger 红、warning 琥珀、info 灰

## Colors

调色板分两层：六网盘品牌色（只在各自的入口按钮上用）和内部状态色（弹窗内统一）。

### Primary
- **品牌默认蓝** (#09AAFF)：脚本默认主题色，百度入口按钮、内部 `pl-btn-primary` 主操作按钮、链接高亮。
- **阿里紫蓝** (#637dff)：阿里入口按钮。
- **天翼蓝** (#2b89ea)：天翼入口按钮。
- **迅雷蓝** (#3f85ff)：迅雷入口按钮。
- **移动蓝** (#3181f9)：移动入口按钮。
- **夸克白** (#ffffff)：夸克入口按钮，描边样式，区别于其他五家的实心。

### Neutral
- **墨黑** (#111)：主文本。
- **次级灰** (#606266)：次级文本、info 按钮背景。
- **三级灰** (#909399)：占位、禁用态。
- **描边灰** (#e6e8eb)：边框、分隔线。
- **画布白** (#fff)：弹窗背景。
- **微底灰** (#f5f6f7)：次级容器背景。

### State
- **成功绿** (#55af28)：推送成功、复制成功。
- **危险红** (#cc3235)：推送失败、错误链接、超限提示。
- **警告琥珀** (#da9328)：描边样式警告按钮。
- **信息灰** (#606266)：已推送、中性状态。

**The 品牌隔离 Rule.** 六网盘品牌色只出现在各自的入口按钮上，不渗透进内部弹窗。弹窗内一律用 `brand-default` (#09AAFF) 和状态色。用户不会在 API 下载弹窗里看到阿里紫蓝。

## Typography

系统字体栈，无外部字体。字号阶梯：12 / 14 / 16px。

**Body Font:** system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
**Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas, monospace（仅 SweetAlert2 继承）

### Hierarchy
- **Body** (400, 14px, 1.5)：所有按钮、链接、表格文本。
- **Label** (500, 12px)：次级标签、文件大小、辅助信息。
- **Dialog** (400, 16px)：SweetAlert2 弹窗正文（`!important` 覆盖默认）。

## Layout

API 下载弹窗是核心布局单元。800px 宽，每行三段：文件名（118px 固定，flex 0 1 118px）+ 下载链接（flex-grow 1，占剩余）+ 操作按钮组。

- 文件名与链接按 1:3 分配空间（118px : ~352px）
- 文件名超长截断，悬停 `.listener-tip` 显示完整名
- 按钮组：IDM 下载（实心主操作）+ 复制链接 + 复制文件名（描边次要）
- 行间距由 `pl-item` 的 padding 撑开

设置弹窗用 SweetAlert2，`target: document.body` + `didOpen` 穿透微前端遮挡，z-index 2147483647。

## Elevation & Depth

近扁平。唯一的阴影出现在弹窗容器上：

- **弹窗阴影** (`0 1px 2px rgb(28 28 32 / 4%), 0 6px 16px rgb(28 28 32 / 8%)`)：SweetAlert2 弹窗，双层极淡投影。

**The 近扁平 Rule.** 按钮和链接无阴影，深度只通过颜色和边框传达。夸克按钮用 1px 描边代替实心背景，是唯一的描边入口按钮。

## Shapes

4-8px 圆角阶梯。入口按钮和内部按钮统一 6px，小元素 4px，弹窗 8px。圆形（50%）只用于加载指示器。

- 入口按钮：6px
- 内部主按钮：6px
- 弹窗：8px（SweetAlert2 默认）
- 滚动条圆角：内联在 `::-webkit-scrollbar-thumb`

## Components

### 入口按钮（六网盘品牌按钮）
- **Shape:** 6px 圆角
- **百度/阿里/天翼/迅雷/移动:** 实心品牌色，白字，hover 加深一档
- **夸克:** 白底 + 1px #ddd 描边，hover 变 #f6f6f6 微底灰
- **Padding:** 4-6px 12px，font-size 14px

### 内部主按钮（pl-btn-primary）
- **Shape:** 6px 圆角，`background: ${color}`（默认 #09AAFF）
- **Hover:** 加深至 #0073e3
- **Active:** `filter: brightness(0.9)`
- **Padding:** 4px 12px

### 状态按钮
- **Success** (绿 #55af28): 推送/复制成功，带淡入动画
- **Danger** (红 #cc3235): 推送失败
- **Warning** (透明 + 琥珀描边): 警告
- **Info** (灰 #606266): 已完成的中性态

### API 下载行（pl-row-api）
- 文件名 118px 固定 + 链接 flex-grow + 按钮组
- 文件名悬停显示完整名（`.listener-tip`）
- 三按钮：IDM（实心主）、复制链接（描边次）、复制文件名（描边次）

### 设置弹窗
- SweetAlert2，`target: document.body`，z-index 2147483647
- 保存后 `history.go(0)` 刷新

## Do's and Don'ts

### Do:
- **Do** 保持入口按钮贴近各网盘官网品牌色
- **Do** 弹窗内统一用 `brand-default` (#09AAFF) 和状态色，不混入网盘品牌色
- **Do** 用 `.listener-tip` 悬停显示被截断的完整文件名
- **Do** 保持设置弹窗 `target: document.body` + z-index 2147483647 穿透微前端

### Don't:
- **Don't** 引入外部 CDN 字体、图标库或新依赖
- **Don't** 用 Shadow DOM（破坏 document 级事件委托）
- **Don't** 在普通 API 链接上主动调用 IDM（IDM 有独立按钮）
- **Don't** 改变网盘原页面结构或做去广告

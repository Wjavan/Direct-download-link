# 流程：从零搭建通用托盘启动器

## 步骤 1: 环境准备

```
py -m pip install pystray pillow
```

验证：`pyw -c "import pystray; print('ok')"` — 必须用 `pyw` 而非 `pythonw`，因为 `pyw` 是 Windows py launcher，会自动选择默认 Python（已装好包的那个）。

## 步骤 2: 复制模板

```
generic-tray-launcher.pyw  →  放到目标程序同级目录
```

## 步骤 3: 首次运行配置

双击 `generic-tray-launcher.pyw`，弹出配置窗口：

| 字段 | 说明 |
|------|------|
| 目标 exe | 浏览选择要托管的程序；目录下只有一个 exe 时自动选中 |
| 命令行参数 | 如 `-f config.yaml`，无参数留空 |
| 程序日志 | 程序自身日志路径（可选，留空则自动在程序同目录生成 `&lt;程序名&gt;.log`）；子进程的 stdout/stderr 会自动写到这里，方便排查问题 | 留空 |
| 锁端口 | 每个程序用不同端口（45680/45681/...） |
| 崩溃自动重启 | 子进程异常退出后自动拉起 |

点「保存并启动」→ 配置写入同目录 `tray_launcher.json`，自动进入托盘模式。

**Web 面板地址无需填写**：程序启动 5 秒后自动用 netstat 对比启动前后的监听端口，推断出子进程开放的端口并生成菜单项（如 `http://127.0.0.1:8080`）。探测有局限时，手动在 `tray_launcher.json` 的 `web_urls` 数组里添加。

## 步骤 4: 验证

```bash
tasklist | grep -i "目标程序名"
```
进程在跑 = 成功。托盘右键菜单能看到自动探测出的 Web 面板地址。

## 步骤 5: 日常使用

之后再双击 `generic-tray-launcher.pyw` 直接进托盘，不弹配置窗口。

**改配置**：托盘右键 →【重新配置】，或命令行 `pyw generic-tray-launcher.pyw --setup`，或直接编辑 `tray_launcher.json`。

## 步骤 6: 开机自启（可选）

注册表方式：
```
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v MyAppTray /t REG_SZ /d "pyw \"C:\path\to\generic-tray-launcher.pyw\"" /f
```

## tray_launcher.json 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `exe_path` | string | 目标程序绝对路径（必填） |
| `cmd_args` | string | 命令行参数，空格分隔，含空格的路径加引号 |
| `proc_log_file` | string | 程序日志路径，留空隐藏菜单项 |
| `web_urls` | array | 手动指定的 Web 面板地址，与自动探测结果合并 |
| `lock_port` | int | 单实例锁端口 |
| `auto_restart` | bool | 崩溃自动重启 |
| `max_fail_streak` | int | 连续失败上限，超过则停止重启 |
| `check_interval` | int | 存活检查间隔（秒） |

## 调试要点

| 问题 | 原因 | 解决 |
|------|------|------|
| 双击无反应 | `pyw` 找不到 `pystray` | `pyw -c "import pystray"` 验证，失败则 `py -m pip install pystray pillow` |
| 配置窗口不弹 | 缺 tkinter | 重装 Python 时勾选 tcl/tk，或改用完整安装包 |
| 托盘日志为空 | 正常现象，程序稳定运行时不输出 | 手动重启/退出时会记录 |
| Web 面板菜单项没出现 | 子进程启动 5 秒内未绑定端口，或端口被其他程序抢占 | 手动填 `web_urls`，或调大代码中 `DETECT_DELAY` |
| 探测出错误的端口 | 检测窗口内别的程序恰好开了端口 | 手动填 `web_urls` 覆盖 |
| 程序输出没看到 | 子进程 stdout/stderr 已自动写到日志文件（`proc_log_file` 留空时默认 `&lt;程序名&gt;.log`） | 托盘右键【查看程序日志】直接用系统编辑器打开日志文件 |
| docstring 中 `\C` 警告 | Python 3.12+ 对转义序列更严格 | 用 raw string 或双反斜杠 `\\` |

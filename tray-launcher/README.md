# Windows 通用托盘启动器（Tray Launcher）

将任意 console 程序（exe/bat/ps1）包装为**无窗口后台驻留 + 系统托盘图标**控制的通用方案。

---

## 原理

Windows 控制台程序（如 PowerShell、cmd、任何 C/C++/Go 编译的 console exe）启动时 OS 自动分配控制台窗口。`-WindowStyle Hidden` 等参数在代码执行后才生效，会闪一下。

**根本解法**：用一个 GUI 子系统的 Python 脚本（`.pyw` + `pythonw`）作为父进程，通过 `CREATE_NO_WINDOW` 标志启动子进程，OS 不分配控制台 → 完全无窗口。

```
用户双击 .pyw
  → pythonw.exe 启动（无控制台）
    → pystray 创建托盘图标
    → subprocess.Popen(目标exe, creationflags=CREATE_NO_WINDOW)
    → 后台线程监控子进程存活状态
```

## 技术栈

| 组件 | 作用 |
|------|------|
| `pystray` | 系统托盘图标 + 右键菜单 |
| `Pillow (PIL)` | 程序化生成托盘图标（无需外部 ico 文件） |
| `subprocess.Popen` | 启动子进程，`CREATE_NO_WINDOW` 隐藏窗口 |
| `threading` | 后台监控线程，检测崩溃 + 自动重启 |
| `socket` | 端口绑定实现单实例锁 |
| `ctypes` | 依赖缺失时弹 MessageBox 提示 |
| `.pyw` 扩展名 | 关联到 `pythonw.exe`，启动时无控制台 |

## 核心机制

### 1. CREATE_NO_WINDOW

```python
subprocess.Popen(
    cmd,
    creationflags=0x08000000 | 0x00000200,  # CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
)
```

`0x08000000` = `CREATE_NO_WINDOW`，告诉 Windows 不为子进程分配控制台。
`0x00000200` = `CREATE_NEW_PROCESS_GROUP`，使子进程独立于父进程的进程组。

### 2. .pyw + pythonw

`.pyw` 文件关联到 `pythonw.exe`（而非 `python.exe`），Python 解释器自身不创建控制台窗口。这是**双重保险**：
- 父进程（pythonw）无窗口
- 子进程（CREATE_NO_WINDOW）无窗口

### 3. 单实例锁

```python
def acquire_single_instance():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", LOCK_PORT))
        s.listen(1)
        return s
    except OSError:
        return None  # 端口已被占用 → 已有实例在跑
```

绑定固定端口，第二次运行时 bind 失败 → 直接退出。

### 4. 崩溃监控 + 自动重启

后台线程每 N 秒检查 `proc.poll()`：
- 返回 `None` → 进程仍在运行，跳过
- 返回非 None → 进程已退出：
  - 退出码 0 或 `AUTO_RESTART=False` → 不重启
  - 退出码非 0 → 3 秒后自动重启，连续失败 ≥ `MAX_FAIL_STREAK` 次则停止 + 弹窗提示

`gen` 代数计数器防止重启时监控线程误判旧进程。

### 5. 托盘菜单

右键托盘图标提供：
- 打开 Web 管理面板（如有）
- 查看托盘日志 / 程序日志
- 手动重启
- 退出（先停止子进程再退出）

---

## 使用方法

### 前置依赖

```bash
py -m pip install pystray pillow
```

仅需这两个第三方包，无其他依赖。

### 首次运行：配置窗口

1. 将 `generic-tray-launcher.pyw` 放到目标程序同级目录
2. 双击运行，弹出配置窗口

| 字段 | 说明 | 示例 |
|------|------|------|
| 目标 exe | 浏览选择；目录下只有一个 exe 时自动选中 | `myapp.exe` |
| 命令行参数 | 空格分隔，含空格的路径加引号 | `-f config.yaml` |
| 程序日志 | 程序自身日志路径（可选，留空则自动在程序同目录生成 `<程序名>.log`）；子进程的 stdout/stderr 会自动写到这里，方便排查问题 | 留空 |
| 锁端口 | 每个程序用不同端口 | `45680` |
| 崩溃自动重启 | 子进程异常退出后自动拉起 | 勾选 |

3. 点「保存并启动」→ 配置写入同目录 `tray_launcher.json`，直接进入托盘模式

### WebUI 自动探测

配置窗口里**没有 Web 面板地址输入框**——它由程序自动探测：

1. 启动子进程前，用 `netstat -ano` 快照当前所有监听端口
2. 子进程启动 5 秒后（`DETECT_DELAY`）再快照一次
3. 差集中的端口即为子进程新开放的，生成菜单项（如 `http://127.0.0.1:8080`）
4. 探测完成后托盘菜单自动刷新

探测有局限时（别的程序恰好开端口、子进程绑定慢），在 `tray_launcher.json` 的 `web_urls` 数组中手动指定，与自动探测结果合并显示。

### 日常使用

- 再双击 `generic-tray-launcher.pyw` → 直接进托盘，不弹配置窗口
- **改配置**：托盘右键 →【重新配置】；或 `pyw generic-tray-launcher.pyw --setup`；或直接编辑 `tray_launcher.json`

### tray_launcher.json 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `exe_path` | string | 目标程序绝对路径（必填，失效则自动弹配置窗口） |
| `cmd_args` | string | 命令行参数 |
| `proc_log_file` | string | 程序日志路径，留空则自动在程序同目录生成 `<程序名>.log`；子进程 stdout/stderr 写到这里 |
| `web_urls` | array | 手动指定的 Web 面板地址 |
| `lock_port` | int | 单实例锁端口 |
| `auto_restart` | bool | 崩溃自动重启 |
| `max_fail_streak` | int | 连续失败上限 |
| `check_interval` | int | 存活检查间隔（秒） |

### 开机自启

**方法 A — 注册表（推荐）**

```
HKCU\Software\Microsoft\Windows\CurrentVersion\Run
```
新建字符串值，数据为 `pyw "C:\path\to\generic-tray-launcher.pyw"`

**方法 B — 任务计划程序**

```bash
schtasks /create /tn "MyApp Tray" /tr "pyw \"C:\path\to\generic-tray-launcher.pyw\"" /sc onlogon /rl limited
```

**方法 C — 启动文件夹**

在 `shell:startup` 中放一个 `.vbs`：
```vbs
CreateObject("WScript.Shell").Run "pyw ""C:\path\to\launcher.pyw""", 0, False
```

---

## 通用模板脚本

```python
# -*- coding: utf-8 -*-
"""
generic-tray-launcher.pyw -- 通用托盘启动器（Windows）

首次运行弹出配置窗口，选择要托管到托盘的 exe；之后直接进入托盘模式。
Web 面板地址由子进程实际监听的端口自动探测生成，无需手动填写。
依赖：py -m pip install pystray pillow
"""

import os
import re
import sys
import time
import json
import shlex
import socket
import logging
import subprocess
import threading

BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE     = os.path.join(BASE_DIR, "tray_launcher.json")
LOG_FILE        = os.path.join(BASE_DIR, "tray_launcher.log")
LOCK_PORT       = 45680
AUTO_RESTART    = True
MAX_FAIL_STREAK = 3
CHECK_INTERVAL  = 30
DETECT_DELAY    = 5

_LOG_FMT = "%(asctime)s %(levelname)s %(message)s"
try:
    logging.basicConfig(filename=LOG_FILE, level=logging.INFO,
                        format=_LOG_FMT, encoding="utf-8")
except TypeError:
    logging.basicConfig(filename=LOG_FILE, level=logging.INFO,
                        format=_LOG_FMT)


def _msgbox(text, title="托盘启动器"):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, text, title, 0x10)
    except Exception:
        pass


try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError as e:
    _msgbox("缺少运行依赖 pystray / pillow，请执行：\n"
            "py -m pip install pystray pillow\n\n%s" % e)
    sys.exit(1)

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
except ImportError:
    tk = None


DEFAULT_CFG = {
    "exe_path": "",
    "cmd_args": "",
    "proc_log_file": "",
    "web_urls": [],
    "lock_port": LOCK_PORT,
    "auto_restart": True,
    "max_fail_streak": MAX_FAIL_STREAK,
    "check_interval": CHECK_INTERVAL,
}


def load_config():
    if not os.path.exists(CONFIG_FILE):
        return None
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except (json.JSONDecodeError, OSError):
        logging.exception("配置文件损坏，将重新配置")
        return None
    if not cfg.get("exe_path") or not os.path.exists(cfg["exe_path"]):
        logging.warning("配置中的 exe_path 无效：%r", cfg.get("exe_path"))
        return None
    out = dict(DEFAULT_CFG)
    out.update(cfg)
    return out


def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
        return True
    except OSError:
        logging.exception("保存配置失败")
        _msgbox("保存配置失败，请检查目录权限：\n%s" % CONFIG_FILE)
        return False


def split_args(s):
    if not s or not s.strip():
        return []
    toks = shlex.split(s.strip(), posix=False)
    return [t.strip('"').strip() for t in toks if t.strip()]


def find_default_exe():
    try:
        names = os.listdir(BASE_DIR)
    except OSError:
        return ""
    self_name = os.path.basename(sys.argv[0]).lower()
    exes = [n for n in names
            if n.lower().endswith(".exe") and n.lower() != self_name]
    if len(exes) == 1:
        return os.path.join(BASE_DIR, exes[0])
    return ""


_LISTEN_RE = re.compile(r":(\d+)\s+\S+\s+LISTENING\s+\d+\s*$")


def snapshot_listening_ports():
    try:
        r = subprocess.run(["netstat", "-ano"], capture_output=True,
                           creationflags=0x08000000, timeout=10)
    except Exception:
        logging.exception("netstat 执行失败")
        return set()
    ports = set()
    for line in r.stdout.decode("utf-8", "replace").splitlines():
        m = _LISTEN_RE.search(line)
        if m:
            ports.add(int(m.group(1)))
    return ports


def detect_web_urls(before_ports):
    after = snapshot_listening_ports()
    new = sorted(after - before_ports)
    return ["http://127.0.0.1:%d" % p for p in new]


proc_info      = {"proc": None, "gen": 0, "start": 0.0, "ports_before": set()}
proc_info_lock = threading.Lock()
fail_streak    = {"n": 0}
stopping       = False
reconfig       = False
lock_sock      = None
tray_icon      = None
detected_urls  = []

cfg = load_config()


def start_proc():
    if not cfg or not os.path.exists(cfg["exe_path"]):
        logging.error("未找到 %s", cfg.get("exe_path") if cfg else "")
        return False
    cmd = [cfg["exe_path"]] + split_args(cfg.get("cmd_args", ""))
    before = snapshot_listening_ports()
    # stdout/stderr 重定向到日志文件，捕获子进程输出
    log_path = cfg.get("proc_log_file") or os.path.join(
        BASE_DIR, os.path.splitext(os.path.basename(cfg["exe_path"]))[0] + ".log")
    logf = None
    try:
        logf = open(log_path, "a", encoding="utf-8", errors="replace")
        proc = subprocess.Popen(cmd,
                                cwd=os.path.dirname(cfg["exe_path"]),
                                stdout=logf,
                                stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL,
                                creationflags=0x08000000 | 0x00000200)
    except Exception:
        logging.exception("启动失败：%s", cmd)
        if logf:
            logf.close()
        return False
    # logf 由子进程继承句柄后即可关闭（父进程不写它）
    logf.close()
    with proc_info_lock:
        proc_info["gen"] += 1
        proc_info["proc"] = proc
        proc_info["start"] = time.time()
        proc_info["ports_before"] = before
    logging.info("已启动 %s (PID=%s)，输出见 %s",
                 os.path.basename(cfg["exe_path"]), proc.pid, log_path)
    threading.Thread(target=_web_detect_thread, daemon=True).start()
    return True


def _web_detect_thread():
    time.sleep(DETECT_DELAY)
    with proc_info_lock:
        before = proc_info.get("ports_before", set())
    urls = detect_web_urls(before)
    if not urls:
        logging.info("未探测到子进程开放的新端口")
        return
    global detected_urls
    detected_urls = urls
    refresh_menu()
    logging.info("探测到 Web 面板：%s", ", ".join(urls))


def stop_proc():
    with proc_info_lock:
        proc = proc_info["proc"]
        proc_info["proc"] = None
    if proc is None:
        return
    if proc.poll() is None:
        logging.info("正在停止 (PID=%s)...", proc.pid)
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           creationflags=0x08000000, capture_output=True)
        except Exception:
            logging.exception("停止出错")


def monitor_loop():
    global stopping
    while True:
        time.sleep(cfg.get("check_interval", CHECK_INTERVAL))
        if stopping:
            return
        with proc_info_lock:
            proc    = proc_info["proc"]
            gen     = proc_info["gen"]
            started = proc_info["start"]
        if proc is None:
            continue
        if proc.poll() is not None:
            with proc_info_lock:
                if gen != proc_info["gen"] or proc_info["proc"] is not proc:
                    continue
            code = proc.returncode
            if code == 0 or not cfg.get("auto_restart", True):
                logging.warning("程序正常退出（退出码=%s），不再自动重启", code)
                continue
            if time.time() - started > 120:
                fail_streak["n"] = 0
            fail_streak["n"] += 1
            max_fail = cfg.get("max_fail_streak", MAX_FAIL_STREAK)
            if fail_streak["n"] >= max_fail:
                logging.error("连续 %s 次异常退出，已停止自动重启", max_fail)
                _msgbox("连续启动失败，已停止自动重启。")
                fail_streak["n"] = 0
                continue
            logging.warning("异常退出（退出码=%s），3 秒后自动重启（第 %s 次）",
                            code, fail_streak["n"])
            time.sleep(3)
            with proc_info_lock:
                if stopping or gen != proc_info["gen"] or proc_info["proc"] is not proc:
                    continue
            start_proc()


def make_icon_image():
    img = Image.new("RGB", (64, 64), (20, 20, 30))
    d = ImageDraw.Draw(img)
    d.ellipse((8, 8, 56, 56), fill=(30, 140, 200))
    d.ellipse((22, 22, 42, 42), fill=(20, 20, 30))
    return img


def make_open_web(url):
    def _open(icon, item):
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            logging.exception("打开 Web 面板失败：%s", url)
    return _open


def collect_web_urls():
    urls = list(cfg.get("web_urls") or [])
    for u in detected_urls:
        if u not in urls:
            urls.append(u)
    return urls


def build_menu():
    items = []
    for url in collect_web_urls():
        items.append(pystray.MenuItem(url, make_open_web(url)))
    if items:
        items.append(pystray.Menu.SEPARATOR)
    items.append(pystray.MenuItem("查看托盘日志", on_open_log))
    proc_log = (cfg or {}).get("proc_log_file", "") or os.path.join(
        BASE_DIR, os.path.splitext(os.path.basename(cfg["exe_path"] if cfg else "app"))[0] + ".log")
    if proc_log:
        items.append(pystray.MenuItem("查看程序日志", on_open_proc_log))
    items.append(pystray.Menu.SEPARATOR)
    items.append(pystray.MenuItem("重新配置", on_reconfig))
    items.append(pystray.MenuItem("重启", on_restart))
    items.append(pystray.MenuItem("退出", on_quit))
    return pystray.Menu(*items)


def refresh_menu():
    if tray_icon is not None:
        tray_icon.menu = build_menu()
        tray_icon.update_menu()


def on_open_log(icon, item):
    try:
        os.startfile(LOG_FILE)
    except Exception:
        logging.exception("打开托盘日志失败")


def on_open_proc_log(icon, item):
    try:
        path = (cfg or {}).get("proc_log_file", "") or os.path.join(
            BASE_DIR, os.path.splitext(os.path.basename(cfg["exe_path"] if cfg else "app"))[0] + ".log")
        if not path or not os.path.exists(path):
            _msgbox("程序日志文件不存在：\n%s\n\n程序启动后才会生成。" % path)
            return
        os.startfile(path)
    except Exception:
        logging.exception("打开程序日志失败")


def on_restart(icon, item):
    logging.info("用户触发【重启】")
    fail_streak["n"] = 0
    stop_proc()
    time.sleep(1)
    if not start_proc():
        _msgbox("重启失败，请查看日志：%s" % LOG_FILE)


def on_reconfig(icon, item):
    global reconfig, stopping
    logging.info("用户触发【重新配置】")
    reconfig = True
    stopping = True
    stop_proc()
    icon.stop()


def on_quit(icon, item):
    global stopping
    logging.info("用户点击【退出】")
    stopping = True
    stop_proc()
    icon.stop()
    os._exit(0)


def run_wizard(existing=None):
    if tk is None:
        _msgbox("缺少 tkinter，无法显示配置窗口。\n请手动创建并编辑 tray_launcher.json")
        return None
    base = dict(DEFAULT_CFG)
    if existing:
        base.update(existing)
    if not base.get("exe_path"):
        base["exe_path"] = find_default_exe()

    root = tk.Tk()
    root.title("托盘启动器 -- 配置")
    root.resizable(False, False)
    root.eval("tk::PlaceWindow . center")

    tk.Label(root, text="通用托盘启动器",
             font=("Microsoft YaHei UI", 13, "bold")).pack(pady=(16, 2))
    tk.Label(root, text="选择要托管到托盘的程序，保存后自动进入托盘模式",
             fg="#666").pack(pady=(0, 12))

    def field(label, initial, browse_mode=None):
        row = tk.Frame(root)
        row.pack(fill="x", padx=18, pady=3)
        tk.Label(row, text=label, width=12, anchor="w").pack(side="left")
        var = tk.StringVar(value=initial)
        tk.Entry(row, textvariable=var).pack(side="left", fill="x", expand=True, ipady=2)
        if browse_mode:
            def pick():
                if browse_mode == "exe":
                    p = filedialog.askopenfilename(
                        title="选择目标程序",
                        filetypes=[("可执行文件", "*.exe"), ("所有文件", "*.*")],
                        initialdir=BASE_DIR)
                else:
                    p = filedialog.asksaveasfilename(
                        title="选择程序日志路径", defaultextension=".log",
                        filetypes=[("日志文件", "*.log"), ("所有文件", "*.*")],
                        initialdir=BASE_DIR)
                if p:
                    var.set(p)
            tk.Button(row, text="浏览…", command=pick).pack(side="left", padx=(6, 0))
        return var

    var_exe  = field("目标 exe：", base["exe_path"], browse_mode="exe")
    var_args = field("命令行参数：", base["cmd_args"])
    var_log  = field("程序日志：", base["proc_log_file"], browse_mode="log")

    adv = tk.Frame(root)
    adv.pack(fill="x", padx=18, pady=8)
    var_port = tk.StringVar(value=str(base["lock_port"]))
    tk.Label(adv, text="锁端口：").pack(side="left")
    tk.Entry(adv, textvariable=var_port, width=8).pack(side="left", padx=(4, 14))
    var_ar = tk.BooleanVar(value=bool(base["auto_restart"]))
    tk.Checkbutton(adv, text="崩溃自动重启", variable=var_ar).pack(side="left")

    tk.Label(root,
             text="Web 面板地址会在程序启动后自动探测端口生成；\n也可稍后在 tray_launcher.json 的 web_urls 中手动添加",
             fg="#888", justify="left").pack(padx=18, pady=(0, 8))

    result = {}

    def on_ok():
        exe = var_exe.get().strip()
        if not exe or not os.path.exists(exe):
            messagebox.showerror("错误", "请选择一个有效的 exe 文件")
            return
        try:
            port = int(var_port.get().strip())
            if not (1024 <= port <= 65535):
                raise ValueError
        except ValueError:
            messagebox.showerror("错误", "锁端口必须是 1024~65535 的整数")
            return
        result.update({
            "exe_path": os.path.abspath(exe),
            "cmd_args": var_args.get().strip(),
            "proc_log_file": var_log.get().strip(),
            "web_urls": list(base.get("web_urls") or []),
            "lock_port": port,
            "auto_restart": var_ar.get(),
            "max_fail_streak": base.get("max_fail_streak", MAX_FAIL_STREAK),
            "check_interval": base.get("check_interval", CHECK_INTERVAL),
        })
        root.destroy()

    def on_cancel():
        root.destroy()

    btns = tk.Frame(root)
    btns.pack(pady=(4, 16))
    tk.Button(btns, text="取消", width=8, command=on_cancel).pack(side="left", padx=6)
    tk.Button(btns, text="保存并启动", width=12, command=on_ok).pack(side="left", padx=6)

    root.mainloop()
    return result or None


def acquire_single_instance(port):
    global lock_sock
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        s.listen(1)
        lock_sock = s
        return True
    except OSError:
        return False


def run_tray():
    global stopping, tray_icon
    stopping = False
    app_name = os.path.splitext(os.path.basename(cfg["exe_path"]))[0]
    logging.info("========== 托盘启动器启动（%s） ==========", app_name)
    if not start_proc():
        _msgbox("启动失败！\n请查看日志：%s" % LOG_FILE)
    tray_icon = pystray.Icon("tray_" + app_name, make_icon_image(),
                             app_name, build_menu())
    threading.Thread(target=monitor_loop, daemon=True).start()
    tray_icon.run()


def main():
    global cfg
    port = (cfg or {}).get("lock_port", LOCK_PORT)
    if not acquire_single_instance(port):
        logging.warning("已有实例运行（LOCK_PORT=%s），本次退出", port)
        return
    if cfg is None or "--setup" in sys.argv:
        new_cfg = run_wizard(existing=cfg)
        if new_cfg is None:
            logging.info("用户取消配置，退出")
            return
        if not save_config(new_cfg):
            return
        cfg = new_cfg
    run_tray()
    if reconfig:
        try:
            lock_sock.close()
        except Exception:
            pass
        time.sleep(0.5)
        subprocess.Popen([sys.executable, os.path.abspath(__file__), "--setup"],
                         creationflags=0x08000000)
        os._exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("启动器发生未捕获异常")
        _msgbox("异常：%r\n详见日志：%s" % (sys.exc_info()[1], LOG_FILE))

```
```

---

## 常见问题

### Q: 配置窗口不弹出

缺 tkinter。重装 Python 时勾选 tcl/tk 组件，或改用完整安装包。临时办法：手动创建 `tray_launcher.json`。

### Q: Web 面板菜单项没出现

自动探测的局限：子进程在启动 5 秒内（`DETECT_DELAY`）未绑定端口，或检测窗口内别的程序恰好开了端口。手动在 `tray_launcher.json` 的 `web_urls` 中添加，或调大代码中的 `DETECT_DELAY`。

### Q: 程序输出没看到

子进程的 stdout/stderr 已自动重定向到日志文件：`proc_log_file` 留空时默认在同目录生成 `<程序名>.log`。托盘右键【查看程序日志】直接用系统默认编辑器打开日志文件。
### Q: 双击没反应

`.pyw` 关联的 Python 解释器找不到 `pystray`。运行 `pyw -c "import pystray"` 验证。若失败，`py -m pip install pystray pillow` 后确认安装到了与 `pyw` 同一解释器下。

### Q: pythonw vs pyw

`pythonw.exe` 是特定 Python 安装下的无控制台版本。`pyw` 是 Windows py launcher 的无控制台版本，会自动选择默认 Python。优先用 `pyw`，兼容性更好。

### Q: 托盘日志为空

`logging.basicConfig` 写入文件，如果程序正常运行不会输出太多日志。手动重启/退出时会记录。属正常现象。

### Q: 子进程不退出

`proc.terminate()` 在 Windows 下等价于 `TerminateProcess`（强杀），只杀进程自身。模板已用 `taskkill /F /T /PID` 递归杀整个进程树，若目标程序会派生孙子进程则依赖此行为。

### Q: 隐藏已有窗口（而非 console）

如果目标程序是 GUI 程序（有自己的窗口但不想显示），本方案不适用。改用 `win32gui.ShowWindow(hwnd, SW_HIDE)` 或 [Trayifier](https://github.com/Silun/Trayifier)。

---

## 参考项目

| 项目 | 说明 |
|------|------|
| [Wjavan/llama-server-tray](https://github.com/Wjavan/llama-server-tray) | 本方案的原型，为 llama-server 定制 |
| [tushev/trayappcontrol](https://github.com/tushev/trayappcontrol) | YAML 配置驱动的多进程托盘管理器（C#） |
| [stax76/run-hidden](https://github.com/stax76/run-hidden) | 仅隐藏窗口无托盘（Go，单文件） |
| [revoconner/Headless-TTY](https://github.com/revoconner/Headless-TTY) | ConPTY 方案，保留交互式 console 输出（C++） |

---

## 实际案例

| 案例 | 目标程序 | 配置窗口怎么填 |
|------|---------|---------------|
| llama-server 托盘 | `llama-server.exe` | 目标 exe 选版本文件夹内的 exe；命令行参数填 `--port 8080 --models-dir Models --ctx-size 65536`；Web 面板自动探测出 8080 |
| subs-check-pro 托盘 | `subs-check-pro.exe` | 命令行参数填 `-f config/config.yaml`；Web 面板自动探测出 WebUI(8199) 和 Sub-Store(8299) 两个 |

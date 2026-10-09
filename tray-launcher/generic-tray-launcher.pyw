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

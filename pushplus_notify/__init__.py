import json
import urllib.request
from datetime import datetime
from pathlib import Path

DEBUG = Path(__file__).parent / "debug.log"

def _log(msg):
    try:
        with open(DEBUG, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now()}] {msg}\n")
    except Exception:
        pass


def _send(token, title, content):
    try:
        payload = json.dumps({
            "token": token,
            "title": title,
            "content": content,
            "template": "txt"
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://www.pushplus.plus/send",
            data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        _log(f"send error: {e}")
        return None


def on_post_llm_call(**kwargs):
    ctx = kwargs.get("ctx")
    if not ctx:
        _log("no ctx in kwargs")
        return

    config = ctx.get_config() or {}
    if not config.get("enabled", True):
        _log(f"plugin disabled via config, skip (enabled={config.get('enabled')})")
        return

    token = config.get("token", "")
    if not token:
        _log("no token configured in config, skip")
        return

    _log(f"hook fired, keys={list(kwargs.keys())}")
    try:
        user_message = kwargs.get("user_message", "") or ""
        assistant_response = kwargs.get("assistant_response", "") or ""
        if not assistant_response.strip():
            _log("empty response, skip")
            return
        content = assistant_response[:3900]
        if len(assistant_response) > 3900:
            content += "\n...(truncated)"
        title = (user_message or "Hermes")[:30]
        result = _send(token, f"[Hermes] {title}", content)
        _log(f"send result: {result}")
    except Exception as e:
        _log(f"hook error: {e}")


def register(ctx):
    _log("register() called")
    try:
        ctx.register_hook("post_llm_call", on_post_llm_call)
        _log("hook post_llm_call registered")
    except Exception as e:
        _log(f"register error: {e}")

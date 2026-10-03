import json
import os
import sqlite3
import threading
import urllib.request
from datetime import datetime
from pathlib import Path

DEBUG = Path(__file__).parent / "debug.log"
# plugin context，register() 时保存；hook 回调据此读取 enabled 开关和 token
_CTX = None
# 记录本回合是否已推送过完整回复（turn_id -> bool）。
# ws 断连重连会重复触发 on_session_end；只有"跑过真实回合"才值得通知。
_turns_with_reply = set()
_MAX_TRACKED = 200

# 失败回合观察器停止信号
_stop_watcher = threading.Event()
# 猴子补丁锁
_patch_lock = threading.Lock()
# state.db 路径缓存
_STATE_DB_PATH_CACHE = None
# last_seen_id 持久化文件
_LAST_SEEN_ID_FILE = Path(__file__).parent / ".last_failed_turn_id"

def _STATE_DB_PATH() -> str | None:
    """从 HERMES_HOME 推导 state.db 路径（缓存结果）。"""
    global _STATE_DB_PATH_CACHE
    if _STATE_DB_PATH_CACHE is not None:
        return _STATE_DB_PATH_CACHE or None
    try:
        from hermes_constants import get_hermes_home
        _STATE_DB_PATH_CACHE = str(get_hermes_home() / "state.db")
    except Exception:
        _STATE_DB_PATH_CACHE = ""
    return _STATE_DB_PATH_CACHE or None

def _mark_turn(turn_id):
    """标记 turn 已活跃（模型开始调用了）；后续 on_session_end 据此区分空回合。"""
    if turn_id:
        _turns_with_reply.add(turn_id)
        if len(_turns_with_reply) > _MAX_TRACKED:
            _turns_with_reply.discard(next(iter(_turns_with_reply)))

# 已通知过的 (turn_id, kind)——ws 重连会对同一 turn 重复触发 on_session_end
_notified = set()

def _log(msg):
    try:
        with open(DEBUG, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now()}] {msg}\n")
    except Exception:
        pass

def _get_config(key: str, default=None):
    """统一读取插件配置；_CTX 未就绪或异常时返回 default。"""
    if _CTX is None:
        return default
    try:
        return _CTX.get_config(key, default)
    except Exception as e:
        _log(f"read config {key} error: {e}")
        return default


def _token() -> str:
    """从插件配置读 token；没配置返回空串（发送时跳过并记日志）。"""
    return _get_config("token", "") or ""

def _send(title, content, template="txt"):
    token = _token()
    if not token:
        _log("no token configured, skip send")
        return None
    try:
        payload = json.dumps({
            "token": token,
            "title": title,
            "content": content,
            "template": template
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

def _enabled() -> bool:
    """读取插件配置里的 enabled 开关；缺省视为启用，读取失败按启用处理。"""
    return _get_config("enabled", True) is not False

def _notify_async(title, content, template="txt"):
    """detach 线程发送；pre_tool_call 等热点 hook 的回调不能被网络 IO 拖慢。"""
    try:
        threading.Thread(target=_send, args=(title, content, template), daemon=True).start()
    except Exception as e:
        _log(f"notify_async error: {e}")

def on_pre_llm_call(**kwargs):
    """模型开始本回合的第一个 LLM 调用——标记 turn 活跃，供 on_session_end 过滤空回合。"""
    _mark_turn(kwargs.get("turn_id"))

def on_pre_tool_call(**kwargs):
    """clarify 提问等用户选择时通知。此 hook 超时会阻断工具调用，必须立即返回。"""
    if kwargs.get("tool_name") != "clarify" or not _enabled():
        return
    try:
        questions = (kwargs.get("args") or {}).get("questions") or []
        lines = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            text = q.get("question") or ""
            choices = q.get("choices") or []
            if choices:
                text += "\n  → " + " / ".join(str(c) for c in choices)
            if text:
                lines.append(text)
        body = ("Hermes 停下来等你选择：\n\n" + "\n\n".join(lines)) if lines else "Hermes 停下来等你回答。"
        _notify_async("[Hermes] ❓ 需要你决定", body[:1500])
    except Exception as e:
        _log(f"pre_tool_call hook error: {e}")

def on_pre_approval_request(**kwargs):
    """危险操作等用户批准时通知；自动审批(smart)与合并等待(coalesced)跳过。"""
    if not _enabled() or kwargs.get("surface") == "smart" or kwargs.get("coalesced"):
        return
    try:
        desc = str(kwargs.get("description") or "")[:200]
        cmd = str(kwargs.get("command") or "")[:150]
        lines = ["Hermes 停下来等待你批准操作。"]
        if desc:
            lines.append(f"操作: {desc}")
        if cmd:
            lines.append(f"命令: {cmd}")
        _notify_async("[Hermes] 🔐 等待批准", "\n".join(lines))
    except Exception as e:
        _log(f"pre_approval_request hook error: {e}")

def on_post_llm_call(**kwargs):
    """正常跑完：推送回复内容（原功能）。"""
    if not _enabled():
        _log("post_llm_call: plugin disabled, skip")
        return
    if kwargs.get("platform") == "weixin":
        return

    try:
        user_message = kwargs.get("user_message", "") or ""
        assistant_response = kwargs.get("assistant_response", "") or ""
        if not assistant_response.strip():
            return
        _mark_turn(kwargs.get("turn_id"))
        # 用 markdown 模板发送，微信端按 Markdown 渲染（与桌面端格式一致）
        content = assistant_response[:8000]
        if len(assistant_response) > 8000:
            content += "\n\n...（内容过长已截断）"
        title = " ".join(user_message.split())[:30] if isinstance(user_message, str) and user_message.strip() else "Hermes"
        result = _send(f"[Hermes] {title}", content, template="markdown")
        _log(f"send result: {result}")
    except Exception as e:
        _log(f"hook error: {e}")

def on_session_end(**kwargs):
    """模型异常停止（打断/失败/未完成）时通知；正常完成由 post_llm_call 推送回复。
    过滤 ws 断连重连等空回合：只有产生过回复的 turn 才值得通知。"""
    if not _enabled():
        return
    if kwargs.get("platform") == "weixin":
        return
    if kwargs.get("completed"):
        return
    turn_id = kwargs.get("turn_id")
    # ws 断连 / 后台 tick 没有 turn_id，或 turn_id 不在已回复集合里 → 跳过
    if not turn_id or turn_id not in _turns_with_reply:
        _log(f"on_session_end skipped: turn_id={turn_id} not in reply set (ws detach or idle tick)")
        return
    interrupted = bool(kwargs.get("interrupted"))
    failed = bool(kwargs.get("failed"))
    try:
        reason = str(kwargs.get("turn_exit_reason") or "")
    except Exception:
        reason = ""
    if reason.startswith("TurnExitReason."):
        reason = reason[len("TurnExitReason."):]
    reason = reason[:200]

    kind = ("⛔ 已停止（被打断）" if interrupted
            else "❌ 运行失败" if failed
            else "⏹ 已停止（未完成）")
    dedup = (turn_id, kind)
    if dedup in _notified:
        _log(f"on_session_end deduped: {kind} already notified for turn {turn_id}")
        return
    _notified.add(dedup)
    if len(_notified) > _MAX_TRACKED:
        _notified.discard(next(iter(_notified)))
    content = f"Hermes 停止思考了。\n状态: {kind}"
    if reason:
        content += f"\n退出原因: {reason}"
    try:
        result = _send(f"[Hermes] {kind}", content, template="txt")
        _log(f"on_session_end send result: {result}")
    except Exception as e:
        _log(f"on_session_end hook error: {e}")

def _patch_preflight_rejection():
    """上下文超窗时 Hermes 直接 return，绕过 finalize_turn —— 插件收不到任何 hook。
    猴子补丁 _preflight_timeout_result：模型没被调用就无法走 post_llm_call，
    所以这里发通知，并标记 turn 让后续 on_session_end 去重跳过。"""
    try:
        from agent import conversation_loop
        with _patch_lock:
            if getattr(conversation_loop, "_pushplus_patched", False):
                return
            original = conversation_loop._preflight_timeout_result

            def patched(agent, exc, conversation_history):
                try:
                    if _enabled():
                        _notify_async(
                            "[Hermes] ❌ 对话超窗，模型未启动",
                            f"{str(exc)[:300]}\n\n会话太大，建议 /new 开新会话。",
                        )
                except Exception as e:
                    _log(f"preflight notify error: {e}")
                return original(agent, exc, conversation_history)

            conversation_loop._preflight_timeout_result = patched
            conversation_loop._pushplus_patched = True
        _log("preflight rejection path patched")
    except Exception as e:
        _log(f"patch preflight failed: {e}")


def _watch_failed_turns():
    """stream_drop / context_overflow 等失败场景，Hermes 核心不触发任何 hook，
    但会在 state.db 的 messages 表写入 display_kind='failed_turn'。后台线程轮询
    这张表，发现新的失败消息就推送。纯插件方案，不改 Hermes 源码。"""
    try:
        db_path = _STATE_DB_PATH()
        if not db_path or not os.path.exists(db_path):
            _log("state.db not found, skip failed_turn watcher")
            return
    except Exception as e:
        _log(f"failed_turn watcher init error: {e}")
        return

    def _run():
        # 启动时从文件恢复 last_seen_id，避免重载后重复推历史 failed_turn
        last_seen_id = 0
        try:
            if _LAST_SEEN_ID_FILE.exists():
                last_seen_id = int(_LAST_SEEN_ID_FILE.read_text().strip() or "0")
        except Exception:
            pass
        while not _stop_watcher.is_set():
            try:
                conn = sqlite3.connect(db_path, timeout=5)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, role, timestamp, display_kind, content
                    FROM messages
                    WHERE display_kind = 'failed_turn' AND id > ?
                    ORDER BY id
                """, (last_seen_id,))
                rows = cur.fetchall()
                conn.close()
                for row in rows:
                    last_seen_id = row["id"]
                    try:
                        _LAST_SEEN_ID_FILE.write_text(str(last_seen_id))
                    except Exception:
                        pass
                    if not _enabled():
                        continue
                    content = (row["content"] or "")[:400]
                    _notify_async(
                        "[Hermes] ⚠️ 任务未完成",
                        f"状态: failed_turn\n内容: {content}",
                    )
            except Exception as e:
                _log(f"failed_turn watcher error: {e}")
            _stop_watcher.wait(5)

    t = threading.Thread(target=_run, daemon=True, name="pp-failed-turn-watcher")
    t.start()
    _log("failed_turn watcher started")


def register(ctx):
    global _CTX
    _CTX = ctx
    _log("register() called")
    try:
        ctx.register_hook("pre_llm_call", on_pre_llm_call)
        ctx.register_hook("post_llm_call", on_post_llm_call)
        ctx.register_hook("on_session_end", on_session_end)
        ctx.register_hook("pre_tool_call", on_pre_tool_call)
        ctx.register_hook("pre_approval_request", on_pre_approval_request)
        _patch_preflight_rejection()
        _watch_failed_turns()
        _log("hooks registered: post_llm_call, on_session_end, pre_tool_call, pre_approval_request")
    except Exception as e:
        _log(f"register error: {e}")
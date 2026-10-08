#!/usr/bin/env python3
"""
Email marketing cleaner — deletes promotional emails via IMAP.
Run: python email_cleaner.py             # dry run (list only)
Run: python email_cleaner.py --execute   # actually delete
"""
import imaplib
import email
import email.header
import json
import re
import sys
import os
from datetime import datetime, timedelta

# Register IMAP ID command — required by 126/163 mailboxes
imaplib.Commands['ID'] = ('AUTH', 'SELECTED', 'NONAUTH')

# --- Marketing detection signals ---
# Score >= 3 => marketing

MARKETING_SUBJECT_KEYWORDS = [
    # Chinese
    '优惠', '促销', '折扣', '限时', '特价', '福利', '抢购', '优惠券',
    '满减', '立减', '大促', '爆款', '热卖', '新品上市', '预约',
    '会员日', '狂欢', '盛典', '折扣码', '促销码', '红包', '返现',
    '包邮', '免费试用', '领券', '购物', '精选', '推荐商品',
    '双11', '618', '年货节', '开学季', '中秋', '国庆', '圣诞',
    '签到', '积分', '兑换', '提醒您', '不容错过', '手慢无',
    # English
    'sale', 'discount', 'offer', 'deal', 'coupon', 'promo',
    'newsletter', 'unsubscribe', 'limited time', 'save up to',
    'free shipping', 'clearance', 'new arrivals', 'best sellers',
    'special offer', 'exclusive deal', 'flash sale',
]

MARKETING_SENDER_PATTERNS = [
    r'noreply@', r'no-reply@', r'donotreply@', r'do-not-reply@',
    r'mailer@', r'newsletter@', r'promo@', r'marketing@',
    r'notification@', r'notify@', r'alerts@', r'noreply-',
    r'mailman@', r'bounce@', r'postmaster@', r'edm@',
    r'campaign@', r'sender@', r'reply@', r'system@',
]


def decode_mime_header(value):
    """Decode MIME encoded header to plain string."""
    if not value:
        return ''
    try:
        parts = email.header.decode_header(value)
        result = []
        for data, charset in parts:
            if isinstance(data, bytes):
                result.append(data.decode(charset or 'utf-8', errors='replace'))
            else:
                result.append(data)
        return ''.join(result)
    except Exception:
        return str(value)


def is_marketing(msg):
    """Return (is_marketing_bool, reasons_list)."""
    score = 0
    reasons = []

    # 1. List-Unsubscribe header — strongest signal
    if msg.get('List-Unsubscribe') or msg.get('List-Unsubscribe-Post'):
        score += 3
        reasons.append('List-Unsubscribe header')

    # 2. Sender pattern
    from_raw = msg.get('From', '')
    from_lower = from_raw.lower()
    for pat in MARKETING_SENDER_PATTERNS:
        if re.search(pat, from_lower):
            score += 1
            reasons.append(f'sender: {pat}')
            break

    # 3. Subject keywords
    subject = decode_mime_header(msg.get('Subject', ''))
    subject_lower = subject.lower()
    for kw in MARKETING_SUBJECT_KEYWORDS:
        if kw in subject_lower:
            score += 2
            reasons.append(f'subject keyword: {kw}')
            break

    # 4. Precedence header
    precedence = (msg.get('Precedence') or '').lower()
    if precedence in ('bulk', 'junk', 'list'):
        score += 2
        reasons.append(f'Precedence: {precedence}')

    # 5. X-Mailer
    x_mailer = (msg.get('X-Mailer') or '').lower()
    if x_mailer and any(k in x_mailer for k in ('mail', 'campaign', 'send', 'market', 'edm')):
        score += 1
        reasons.append(f'X-Mailer: {x_mailer}')

    # Whitelist: never delete these senders even if marketing signals present
    from_decoded = decode_mime_header(from_raw).lower()
    # (whitelist is checked by caller via config)

    return score >= 3, reasons


def clean_account(account, dry_run=True, days_back=30):
    """Scan and optionally delete marketing emails from one IMAP account."""
    name = account.get('name', account['email'])
    host = account['imap_host']
    port = account.get('imap_port', 993)
    email_addr = account['email']
    password = account['password']
    whitelist = [d.lower() for d in account.get('whitelist_domains', [])]

    mode = '预览（仅列出，不删除）' if dry_run else '执行（删除中）'
    print(f"\n{'='*60}")
    print(f"  {name} ({email_addr})")
    print(f"  模式：{mode} | 扫描最近 {days_back} 天")
    print(f"{'='*60}")

    try:
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(email_addr, password.replace(' ', ''))  # Gmail app passwords have spaces
        # 网易邮箱(126/163)要求登录后发送ID命令标识客户端，否则SELECT被拒
        mail._simple_command('ID', '("name" "email_cleaner" "version" "1.0")')
        mail.select('INBOX')

        since_date = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
        status, data = mail.uid('search', None, f'SINCE {since_date}')
        if status != 'OK':
            print(f"  搜索失败：{status}")
            mail.logout()
            return 0

        uids = data[0].split() if data[0] else []
        print(f"  收件箱自 {since_date} 起的邮件数：{len(uids)}")

        marketing_found = []
        checked = 0

        for uid in uids:
            status, msg_data = mail.uid('fetch', uid, '(BODY.PEEK[HEADER])')
            if status != 'OK' or not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            is_mark, reasons = is_marketing(msg)
            if not is_mark:
                checked += 1
                continue

            # Check whitelist
            from_decoded = decode_mime_header(msg.get('From', '')).lower()
            if any(d in from_decoded for d in whitelist):
                checked += 1
                continue

            marketing_found.append((uid, msg, reasons))
            checked += 1

        print(f"  已检查：{checked} | 发现营销邮件：{len(marketing_found)}")

        if marketing_found:
            print(f"\n  --- 营销邮件清单 ---")
            for uid, msg, reasons in marketing_found:
                frm = decode_mime_header(msg.get('From', ''))[:60]
                subj = decode_mime_header(msg.get('Subject', ''))[:60]
                print(f"    UID {uid.decode()}")
                print(f"      发件人：{frm}")
                print(f"      主题：{subj}")
                print(f"      判定依据：{', '.join(reasons)}")

        if not dry_run and marketing_found:
            print(f"\n  正在删除 {len(marketing_found)} 封邮件...")
            deleted = 0
            for uid, _, _ in marketing_found:
                status, _ = mail.uid('store', uid, '+FLAGS', '\\Deleted')
                if status == 'OK':
                    deleted += 1
            mail.expunge()
            print(f"  已删除：{deleted}/{len(marketing_found)}")
        elif dry_run and marketing_found:
            print(f"\n  >>> [预览] 将删除 {len(marketing_found)} 封邮件。使用 --execute 参数才会真正删除。 <<<")

        mail.logout()
        return len(marketing_found)

    except imaplib.IMAP4.error as e:
        print(f"  IMAP 错误：{e}")
    except Exception as e:
        print(f"  错误：{e}")
    return 0


def main():
    config_path = os.environ.get(
        'EMAIL_CLEANER_CONFIG',
        os.path.join(os.path.dirname(os.path.abspath(__file__)), 'email_cleaner_config.json')
    )
    dry_run = '--execute' not in sys.argv
    days_back = 30
    for i, arg in enumerate(sys.argv):
        if arg == '--days' and i + 1 < len(sys.argv):
            days_back = int(sys.argv[i + 1])

    if not os.path.exists(config_path):
        print(f"找不到配置文件：{config_path}")
        print("请先创建 email_cleaner_config.json。")
        sys.exit(1)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    total = 0
    for account in config['accounts']:
        if not account.get('enabled', True):
            print(f"\n  跳过 {account.get('name', account['email'])}（未启用）")
            continue
        total += clean_account(account, dry_run=dry_run, days_back=days_back) or 0

    action = '发现' if dry_run else '已删除'
    print(f"\n{'='*60}")
    print(f"  完成。共{action}营销邮件 {total} 封")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

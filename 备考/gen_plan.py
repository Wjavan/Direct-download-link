# -*- coding: utf-8 -*-
import datetime, math, os, re
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

BASE = r"C:\Users\JAVA\Documents\Hermes"
START = datetime.date(2026,10,2)
CET_DAY = datetime.date(2026,12,12)
MEMO_START = datetime.date(2026,11,16)  # 四级复习阶段起点：起启用闪过默写本
END = datetime.date(2027,4,17)
WD = ['一','二','三','四','五','六','日']
BUFFER = {datetime.date(2026,10,1), datetime.date(2027,1,1)}
BUFFER |= {datetime.date(2027,2,5) + datetime.timedelta(days=i) for i in range(7)}  # 春节 2/5~2/11
CANDIDATES = {datetime.date(2027,4,10), datetime.date(2027,4,17), datetime.date(2027,4,24)}
EXAM_DAY = datetime.date(2027,4,17)
REG_START = datetime.date(2027,3,10)
REG_END = datetime.date(2027,3,13)
MILESTONES = {datetime.date(2026,11,30):"里程碑自查·四级模考≥380",
              datetime.date(2026,12,10):"里程碑·数学前5章完成/锐树网课语法看完",
              datetime.date(2027,1,31):"里程碑·数学正确率≥70%/锐树网课全专项看完",
              datetime.date(2027,2,28):"里程碑·专升本模考≥340"}

def wof(d): return (d - START).days // 7 + 1

# ponytail: START=10/2, 33周内容合并为29周（合并4对：复习2对+库课1对+冲刺1对，不删任何内容）
GAOSHU = {
1:"第1章·函数与极限 §1.1–1.3(约P1–30)", 2:"第1章·函数与极限 §1.4–1.8(约P30–48)",
3:"第2章·导数与微分 §2.1–2.2(约P50–78)", 4:"第2章·导数与微分 §2.3–2.5(约P78–96)",
5:"第3章·中值定理与导数应用 §3.1–3.2(约P98–120)", 6:"第3章·§3.3–3.5极值与最值(约P120–140)",
7:"第3章综合复习+例题(约P140–148)", 8:"第4章·不定积分 §4.1–4.2(约P150–172)",
9:"第4章·不定积分 §4.3–4.4(约P172–190)", 10:"第4章综合复习+例题(约P190–196)",
11:"第5章·定积分 §5.1–5.2(约P198–220)", 12:"第5章·定积分 §5.3换元分部(约P220–238)",
13:"第5章·§5.4–5.5反常积分+应用(约P238–258)", 14:"第5章综合+库课章节汇总",
15:"第6章·微分方程 §6.1–6.2(约P260–276)", 16:"第6章·微分方程 §6.3–6.4(约P276–292)",
17:"第6章·微分方程 §6.5–6.6(约P292–306)",
# 原18+19合并
18:"一轮复习第1–4章+错题",
# 原20+21合并
19:"一轮复习第5–6章+库课18套第1–3套精做",
# 原22+23合并（库课4-6+7-9→4-9）
20:"库课18套第4–9套+高数教材二刷(第1–4章)",
21:"库课18套第10–12套+高数教材二刷(第5–6章)",
22:"库课18套第13–15套+全真模考", 23:"冲刺模考+易错专练(极限/导数/积分)+高数教材二刷(全章)",
24:"冲刺模考+易错专练(微分方程/综合)+高数教材二刷(错题)", 25:"冲刺模考+错题清零+高数教材三刷(重点)",
26:"考前调整+易错清单回顾+教材公式速记",
# 原32+33合并
27:"全真模考冲刺+易错重做+公式速记+易错清单",
28:"考前·公式速记+易错清单回顾",
29:"考前最后冲刺·只做易错+适度休息",
}
RUISHU = {
1:"入门课＋名词(一)(二)", 2:"代词(一)(二)＋形容词和副词(一)", 3:"形容词和副词(二)＋连词介词(一)(二)",
4:"数和冠词(一)(二)＋动词的分类(一)", 5:"动词的分类(二)＋时态语态(一)(二)", 6:"非谓语动词(一)(二)＋主谓一致",
7:"词语辨析＋定语从句＋名词性从句", 8:"状语从句＋虚拟语气＋强调句倒装句＋习题精析·词汇与结构", 9:"感叹/祈使/反意＋连词成句(一)(二)＋习题精析·连词成句",
10:"连词成句(三)(四)＋篇章填空(一)＋习题精析·篇章填空", 11:"篇章填空(二)(三)(四)", 12:"篇章填空(五)(六)(七)",
13:"阅读填空(一)(二)＋阅读问答(一)＋习题精析·阅读填空", 14:"阅读问答(二)(三)＋英译汉＋习题精析·阅读问答/总结", 15:"汉译英＋写作(提纲/命题图景)＋习题精析·翻译",
16:"写作(应用文)＋习题精析·写作", 17:"朱老师版·词汇概括＋名词专项＋动词专项(一)＋章节练习·名词15题", 18:"朱老师版·动词专项(二)(三)(四)＋章节练习·动词20题",
19:"朱老师版·形容词专项(一)(二)＋副词专项＋章节练习·形容词10题+副词10题", 20:"朱老师版·句子类型＋句子成分＋宾语从句＋章节练习·句子类型2+成分1+宾语从句26题", 21:"朱老师版·定语从句(一)(二)＋非谓语动词＋章节练习·定语从句20+非谓语24题",
# 原22+23合并
22:"朱老师版·阅读方法＋主旨大意＋推理题＋细节理解(一)(二)＋章节练习·细节理解21题+翻译23题",
# 原24+25合并
23:"二刷·宋版词法动词＋从句特殊句式(易错)",
24:"二刷·宋版阅读(连词成句/篇章填空)", 25:"二刷·朱版词汇语法(易错)",
26:"二刷·朱版阅读翻译写作", 27:"三刷·非谓语/时态语态/定语从句",
# 原30+31合并
28:"冲刺·真题精讲＋模考错题回看＋翻译写作模板",
# 原32+33合并
29:"考前·易错清单＋锐树网课重点回看＋写作模板＋高频词汇冲刺",
}
def section(w):
    if w <= 8: return "词汇语法"
    if w <= 13: return "阅读"
    if w <= 14: return "翻译"
    if w <= 15: return "写作"
    if w <= 22: return "专项综合"
    return "二刷·错题"
def math_exam(w):
    if w < 11: return "同济已学章节阶段自测(总习题+已学库课题)"
    return f"库课18套完整卷第{(w-5)//2}套"
def cet_exam(w):
    e = w//2
    return f"闪过真题第{e}套" if e <= 6 else "新东方冲刺模拟210题卷(估710分)"
ENG_EXAM = {16:"2020年真题", 18:"2021年真题", 20:"2022年真题", 22:"2023年真题", 24:"2024年真题(不完整)", 26:"2025年真题", 28:"2026年真题"}
def sunday_exam(w):
    sunday = START + datetime.timedelta(days=7*(w-1)+4)
    if sunday < CET_DAY:
        return math_exam(w) if w % 2 == 1 else cet_exam(w)
    return math_exam(w) if w % 2 == 1 else f"专升本英语模考·{ENG_EXAM.get(w, '真题综合')}"

import re as _re

def _parse_pages(g):
    """从 '...约P1–30...' 提取 (1, 30)"""
    m = _re.search(r'P(\d+)\s*[\u2013\-]\s*(\d+)', g)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)

def _parse_secs(g):
    """从 '§1.1–1.3' 提取 ['§1.1','§1.2','§1.3']"""
    m = _re.search(r'§(\d+)\.(\d+)\s*[\u2013\-]\s*(\d+)\.(\d+)', g)
    if not m:
        m2 = _re.search(r'§(\d+)\.(\d+)', g)
        return [f"§{m2.group(1)}.{m2.group(2)}"] if m2 else []
    ch_s, sec_s, ch_e, sec_e = int(m.group(1)),int(m.group(2)),int(m.group(3)),int(m.group(4))
    secs = []; ch, sc = ch_s, sec_s
    while ch < ch_e or (ch == ch_e and sc <= sec_e):
        secs.append(f"§{ch}.{sc}"); sc += 1
        if sc > 9: sc = 0; ch += 1
    return secs

def _distribute(items, n=3):
    """将 items 尽量均匀分成 n 组"""
    total = len(items)
    if total == 0: return [[] for _ in range(n)]
    base, extra = divmod(total, n)
    groups = []; idx = 0
    for i in range(n):
        sz = base + (1 if i < extra else 0)
        groups.append(items[idx:idx+sz]); idx += sz
    return groups

def _fmt_secs(secs):
    """['§1.1','§1.2','§1.3'] → '§1.1–1.3'"""
    if not secs: return ""
    if len(secs) == 1: return secs[0]
    first = secs[0].replace("§","")
    last = secs[-1].replace("§","")
    fch = first.split(".")[0]
    lch = last.split(".")[0]
    if fch == lch:
        return f"§{first}–{last.split('.')[-1]}"
    else:
        return f"§{first}–{last}"

def math_daily(g, ai):
    """将 GAOSHU 周条目拆成第 ai 天(0,1,2)的具体内容"""
    ps, pe = _parse_pages(g)
    secs = _parse_secs(g)
    # 章名（取 § 之前的，去掉 · 尾巴）
    ch_name = g.split('§')[0].strip().rstrip('·').strip() if '§' in g else g.split('(')[0].strip().rstrip('+').strip()
    
    if ps and pe:
        total = pe - ps
        seg = max(1, round(total / 3))
        ranges = [(ps, ps+seg), (ps+seg, ps+2*seg), (ps+2*seg, pe)]
        sp, ep = ranges[ai]
        if secs:
            groups = _distribute(secs, 3)
            if groups[ai]:
                sec_str = _fmt_secs(groups[ai])
            else:
                # 分组为空：用全部节号，但标注"综合复习"
                sec_str = _fmt_secs(secs) + "(全节综合)"
            return f"{ch_name} {sec_str}（约P{sp}–{ep}）"
        return f"{ch_name}（约P{sp}–{ep}）"
    
    # 无页码：一轮复习
    if '一轮复习' in g:
        chs = _re.findall(r'第(\d+)–(\d+)章', g)
        if chs:
            a, b = int(chs[0][0]), int(chs[0][1])
            mp = {0: f"第{a}章错题重做", 1: f"第{b}章错题重做", 2: f"第{a}–{b}章综合错题"}
            return f"一轮复习·{mp[ai]}"
        return g
    
    # 无页码：库课18套
    if '库课18套' in g and '第' in g and '套' in g:
        sets = _re.findall(r'第(\d+)–(\d+)套', g)
        if sets:
            a, b = int(sets[0][0]), int(sets[0][1])
            names = []
            for s in range(a, b+1):
                names.append(f"第{s}套")
            groups = _distribute(names, 3)
            return f"库课18套·{''.join(groups[ai]) if groups[ai] else names[0]}精做"
        return g
    
    # 其他无页码条目
    return g

def ruishu_daily(r, ai):
    """将 RUISHU 周条目拆成第 ai 天(0,1,2)的具体讲次"""
    parts = [p.strip() for p in r.split('＋')]
    n = len(parts)
    focuses = ["精看(约20–25min)+笔记标注", "难点回看+重点标注", "综合练习+笔记整理"]
    
    if n == 1:
        return f"《{parts[0]}》{focuses[ai]}"
    if n == 2:
        if ai == 0: return f"《{parts[0]}》精看+笔记标注"
        if ai == 1: return f"《{parts[1]}》精看+笔记标注"
        return f"《{parts[0]}＋{parts[1]}》难点回看+综合练习"
    # n >= 3
    groups = _distribute(parts, 3)
    day_parts = groups[ai]
    if not day_parts:
        day_parts = parts
    joined = '＋'.join(day_parts)
    if ai < 2:
        return f"《{joined}》精看+笔记标注"
    return f"《{joined}》难点回看+综合练习"

def read_daily(w, ai, is_B=False):
    u1, u2 = 2*w-1, 2*w
    if is_B:
        return [f"新东方Unit{u1}·Passage1-3限时+生词复习",
                f"新东方Unit{u2}·Passage1-3限时+生词复习",
                f"Unit{u1}-{u2}·限时4篇+错题分析"][ai]
    return [f"新东方Unit{u1}·Passage1-2限时(8min/篇)",
            f"新东方Unit{u2}·Passage1-2限时(8min/篇)",
            f"Unit{u1}-{u2}·错题重做2篇"][ai]

def listen_daily(w, ai, is_B=False):
    d1, d2 = 2*w-1, 2*w
    if is_B:
        return [f"新东方Day{d1}·完整训练+影子跟读",
                f"新东方Day{d2}·完整训练+影子跟读",
                f"Day{d1}-{d2}·关键词默写+跟读"][ai]
    return [f"新东方Day{d1}·短新闻+长对话",
            f"新东方Day{d2}·短文理解+讲座",
            f"Day{d1}-{d2}·错题重听+影子跟读"][ai]

def a_day_index(d):
    """d 是本周第几个A日(0起)，跳过节假日/CET日——保证页码严格递增"""
    w = wof(d)
    ws = START + datetime.timedelta(days=7*(w-1))
    count = 0
    cur = ws
    while cur <= d:
        if cur.weekday() in (0, 2, 4) and cur not in BUFFER and cur != CET_DAY:
            count += 1
        cur += datetime.timedelta(days=1)
    return count - 1

def b_day_index(d):
    """d 是本周第几个B日(0起)，跳过节假日/CET日"""
    w = wof(d)
    ws = START + datetime.timedelta(days=7*(w-1))
    count = 0
    cur = ws
    while cur <= d:
        if cur.weekday() in (1, 3, 5) and cur not in BUFFER and cur != CET_DAY:
            count += 1
        cur += datetime.timedelta(days=1)
    return count - 1

def summary(d):
    w = wof(d); wd = d.weekday()
    v_pre = "不背单词APP四级词本新35词+复习" + ("，闪过默写本20词" if d >= MEMO_START else "")
    if d in BUFFER:
        if d < CET_DAY:
            return (f"【节假日·约2小时】1.词汇：{v_pre}（不变）｜"
                    "2.高等数学：只复习本周错题30分钟｜"
                    "3.专升本英语：锐树网课重点回看+库课2000题错题20分钟｜"
                    "4.四级：阅读+听力各15分钟轻量复习")
        return ("【节假日·约2小时】1.词汇：不背单词APP转专升本词本+高频词（不变）｜"
                "2.高等数学：只复习本周错题40分钟｜"
                "3.专升本英语：库课2000题错题回顾30分钟")
    if d == CET_DAY: return "CET4 考试日（笔试 2026-12-12，以准考证为准）"
    if d == EXAM_DAY: return "【专升本考试日】目标≥360（数学≥220·英语≥140）——考前只回顾易错清单"
    pre = d < CET_DAY
    is_rev = w >= 18  # 考后二刷阶段（29周制）（新30周制，周18起=原周21起库课刷题）
    if wd == 6:
        if pre:
            return (f"1.数学模考：{math_exam(w)}完整卷2小时估分｜2.错题归因+周复盘+下周计划+进度自查" if w%2==1
                    else f"1.四级模考：{cet_exam(w)}完整真题2小时按710分估分｜2.错题归因+周复盘+下周计划")
        return (f"1.专升本数学模考：{math_exam(w)}2小时估分｜2.错题归因+周复盘" if w%2==1
                else f"1.专升本英语模考：{ENG_EXAM.get(w, '真题综合')}（约2小时）｜2.错题归因+周复盘")
    # ── 二刷/冲刺阶段：高数加教材二刷，英语二刷锐树 ──
    if is_rev:
        # 高数二刷章节映射
        REV_MATH = {18:"第1-4章", 19:"第5-6章",
                    20:"第1-4章", 21:"第5-6章",
                    23:"全章", 24:"错题", 25:"重点",
                    26:"公式速记", 27:"易错清单", 28:"冲刺", 29:"最后冲刺"}
        rev_m = REV_MATH.get(w, "错题")
        if wd in (0,2,4):
            if pre:
                return (f"1.高等数学（30分钟）：同济{GAOSHU[w]}+库课18套2题｜"
                        f"2.专升本英语（30分钟）：锐树网课《{RUISHU[w]}》+库课2000题{section(w)}练习｜"
                        f"3.四级阅读（45分钟）：新东方阅读Unit{2*w-1}-{2*w}·2篇限时｜"
                        f"4.四级听力（30分钟）：新东方听力Day{2*w-1}-{2*w}影子跟读｜"
                        f"5.词汇（45分钟）：{v_pre}｜"
                        f"6.写作翻译（30分钟）：闪过真题·写作翻译综合练习｜"
                        f"7.机动（30分钟）：错题归因+进度自查")
            return (f"1.高等数学（90分钟）：同济{GAOSHU[w]}+库课18套2题（教材二刷·{rev_m}）｜"
                    f"2.专升本英语（75分钟）：锐树网课《{RUISHU[w]}》二刷+库课2000题{section(w)}练习｜"
                    f"3.专升本英语阅读+翻译专项（45分钟）｜"
                    f"4.词汇（30分钟）：不背单词APP转专升本词本+高频词")
        if pre:
            return (f"1.高等数学（30分钟）：错题回顾+库课18套2道新大题+教材回读（{rev_m}）｜"
                    f"2.专升本英语（30分钟）：库课2000题{section(w)}约15题巩固｜"
                    f"3.四级阅读（60分钟）：新东方阅读Unit{2*w-1}-{2*w}·4篇限时｜"
                    f"4.四级听力（60分钟）：新东方听力Day{2*w-1}-{2*w}影子跟读｜"
                    f"5.词汇（45分钟）：{v_pre}｜"
                    f"6.机动（15分钟）：刘晓燕技巧书1节或错题归因")
        return (f"1.高等数学（75分钟）：错题回顾+库课18套2道新大题+教材回读（{rev_m}）｜"
                f"2.专升本英语（90分钟）：库课2000题{section(w)}约15题巩固+锐树网课二刷回看｜"
                f"3.专升本英语完形+写作专项（45分钟）｜"
                f"4.词汇（30分钟）：不背单词APP转专升本词本+高频词")
    
    # ═══ 非二刷阶段：每日内容细分到具体页码/讲次/题号 ═══
    sect = section(w)
    A_MATH_F = ["概念理解+例题精做+库课18套2题", "续讲精做+例题演练+库课18套2题", "课后习题+综合练习+库课18套2题"]
    A_FLEX = ["整理高数错因(概念/计算/审题分类)", "锐树网课笔记回顾+语法考点整理", "进度自查+错题归因+改进计划"]
    B_MATH_F = ["复习对应A日内容+库课18套2道新大题", "概念公式默写+库课18套2道计算题", "综合复习+库课18套错题重做"]
    B_ENG_F = ["库课2000题{sect}·第1-5题巩固+错题标注", "库课2000题{sect}·第6-10题错题重做", "库课2000题{sect}·第11-15题+本周错题总复习"]
    B_FLEX = ["刘晓燕技巧书1节(定位法/预读)", "高数/英语错题归因整理", "刘晓燕技巧书1节或本周错题总复习"]
    A_SPEC = ["专升本英语阅读专项(库课阅读理解)", "专升本英语翻译专项(库课翻译练习)", "专升本英语阅读+翻译综合练习"]
    B_SPEC = ["专升本英语完形填空专项(库课完形)", "专升本英语写作专项(库课写作)", "专升本英语完形+写作综合练习"]
    V_A = ["主动回忆法", "错词清零+标记", "生词重点巩固"]
    V_B = ["本周新词巩固", "默写本听写验证", "本周词汇总复习"]
    V_A_POST = ["主动回忆", "错词巩固", "生词强化"]
    V_B_POST = ["新词巩固", "听写验证", "总复习"]
    # CET4 写作翻译（考前专属，考后转为专升本专项）
    A_CET_WRITE = ["闪过真题·写作模板背诵+仿写1篇", "闪过真题·翻译练习(汉译英5句)", "闪过真题·写作+翻译综合练习"]
    B_CET_WRITE = ["闪过真题·翻译练习(英译汉5句)", "闪过真题·写作模板回顾+限时写作1篇"]
    
    if wd in (0,2,4):
        ai = a_day_index(d)
        m_task = math_daily(GAOSHU[w], ai)
        r_task = ruishu_daily(RUISHU[w], ai)
        rd_task = read_daily(w, ai)
        ls_task = listen_daily(w, ai)
        if pre:
            return (f"1.高等数学（30分钟）：同济{m_task}·{A_MATH_F[ai]}（库课第{min(w,18)}套）｜"
                    f"2.专升本英语（30分钟）：锐树网课{r_task}→库课2000题{sect}约15题｜"
                    f"3.四级阅读（45分钟）：{rd_task}｜"
                    f"4.四级听力（30分钟）：{ls_task}｜"
                    f"5.词汇（45分钟）：{v_pre}（{V_A[ai]}）｜"
                    f"6.写作翻译（30分钟）：{A_CET_WRITE[ai]}｜"
                    f"7.机动（30分钟）：{A_FLEX[ai]}")
        return (f"1.高等数学（90分钟）：同济{m_task}·{A_MATH_F[ai]}（库课第{min(w,18)}套）｜"
                f"2.专升本英语（75分钟）：锐树网课{r_task}→库课2000题{sect}约25题｜"
                f"3.{A_SPEC[ai]}（45分钟）｜"
                f"4.词汇（30分钟）：不背单词APP转专升本词本+高频词（{V_A_POST[ai]}）")
    if wd in (1,3,5):
        bi = b_day_index(d)
        m_review = math_daily(GAOSHU[w], bi)
        rd_task = read_daily(w, bi, is_B=True)
        ls_task = listen_daily(w, bi, is_B=True)
        if pre:
            return (f"1.高等数学（30分钟）：复习{m_review}→{B_MATH_F[bi]}（库课第{min(w,18)}套）｜"
                    f"2.专升本英语（30分钟）：{B_ENG_F[bi].format(sect=sect)}｜"
                    f"3.四级阅读（60分钟）：{rd_task}｜"
                    f"4.四级听力（60分钟）：{ls_task}｜"
                    f"5.词汇（45分钟）：{v_pre}（{V_B[bi]}）｜"
                    f"6.写作翻译（15分钟）：{B_CET_WRITE[bi % 2]}")
        return (f"1.高等数学（75分钟）：复习{m_review}→{B_MATH_F[bi]}（库课第{min(w,18)}套）｜"
                f"2.专升本英语（90分钟）：锐树网课回看+{B_ENG_F[bi].format(sect=sect)}｜"
                f"3.{B_SPEC[bi]}（45分钟）｜"
                f"4.词汇（30分钟）：不背单词APP转专升本词本+高频词（{V_B_POST[bi]}）")
    return "任务异常"

def task_priority(task_text, d):
    """根据每条任务内容+日期，重新分配优先级"""
    t = task_text
    # 节假日/考试日 = 低/高
    if d in BUFFER: return "低"
    if d == CET_DAY or d == EXAM_DAY: return "高"
    # 模考类任务 = 高（出现在任务文本里）
    if "模考" in t: return "高"
    # 机动/错因整理/复盘 = 低（必须在前面判断，因这些任务里可能含"高数"/"英语"字样）
    if t.startswith("6.机动") or t.startswith("5.机动") or t.startswith("4.机动") or t.startswith("3.机动"):
        return "低"
    if "刘晓燕" in t or "进度自查" in t or "整理" in t or "复盘" in t or "错因" in t or "错题归因" in t or "错题整理" in t or "总复习" in t or "回看" in t:
        return "低"
    # 高数/专升本英语（专升本主科）= 高
    if "高等数学" in t or "高数" in t: return "高"
    if "专升本英语" in t: return "高"
    # 四级阅读/听力 CET4前 = 高，CET4后 = 中
    pre = d < CET_DAY
    if "四级阅读" in t or "四级听力" in t:
        return "高" if pre else "中"
    # 写作翻译：考前=高，考后=中
    if "写作翻译" in t or "写作模板" in t or "翻译练习" in t:
        return "高" if pre else "中"
    # 词汇 = 中（贯穿全程）
    if "词汇" in t or "不背" in t or "默写本" in t: return "中"
    return "中"

def remark(d):
    if d in BUFFER: return "节假日·减半(约2小时)"
    if d == CET_DAY: return "CET4考试日"
    if d == EXAM_DAY: return "专升本考试日(参考2026年4/17)"
    if d in CANDIDATES: return "专升本候选考试日(以官方为准)"
    if d in (REG_START, REG_END): return "专升本报名窗口(参考3/10-13)"
    if d in MILESTONES: return MILESTONES[d]
    if d.weekday() == 6: return "模考日"
    if d == datetime.date(2026,12,13): return "CET4已考·四级槽位转入专升本"
    return ""

def weekday_cn(d): return "周" + WD[d.weekday()]

# ---- 逐日数据 ----
days = []
cur = START
while cur <= END:
    days.append((cur, weekday_cn(cur), summary(cur), remark(cur)))
    cur += datetime.timedelta(days=1)

months = []
y, m = days[0][0].year, days[0][0].month
group = []
for row in days:
    if (row[0].year, row[0].month) == (y, m):
        group.append(row)
    else:
        months.append((y, m, group)); y, m = row[0].year, row[0].month; group = [row]
months.append((y, m, group))

def month_md(y, m, rows):
    L = [f"#### {y}年{m}月", ""]
    L.append("| 日期 | 计划事项 | 完成状态 | 优先级 | 实际完成时间 | 备注 |")
    L.append("|---|---|:---:|:---:|---:|:---|")
    for (d, wd, summ, rk) in rows:
        L.append(f"| {d} {wd} | {summ.replace('｜', '<br>')} | □ |  | {rk} |")
    L.append("")
    total = len(rows)
    hi = mi = lo = 0  # 已按任务项分配颜色，不再按天统计
    L.append(f"**{m}月汇总**：已完成天数=统计「☑」数（Excel 公式 `=COUNTIF(D2:D{total+1},\"☑ 已完成\")`）；完成率=已完成÷(已完成+未完成)。每条任务按其重要程度独立填色（高=红·中=黄·低=绿）。")
    L.append("")
    return "\n".join(L)

monthly_md = "\n\n---\n\n".join(month_md(y, m, g) for (y, m, g) in months)

# ---- 3.2 内容推进表（30 周，按天细分，程序生成保证与逐日标签一致）----
def week_range(w):
    s = START + datetime.timedelta(days=7*(w-1)); e = s + datetime.timedelta(days=6)
    return f"{s.strftime('%m-%d')}~{e.strftime('%m-%d')}"
def prog_math(w):
    """高数：把周内容拆成周一/三/五三天箭头"""
    g = GAOSHU[w]
    days = [math_daily(g, i) for i in range(3)]
    base = " → ".join(days)
    # 二刷阶段附加教材回读标注
    REV_TAG = {18:"+教材二刷(第1-4章)", 19:"+教材二刷(第5-6章)",
               20:"+教材二刷(第1-4章)", 21:"+教材二刷(第5-6章)",
               23:"+教材二刷(全章)", 24:"+教材二刷(错题)", 25:"+教材三刷(重点)",
               26:"+公式速记", 27:"+易错清单", 28:"+冲刺", 29:"+最后冲刺"}
    tag = REV_TAG.get(w, "")
    if tag:
        base += f" {tag}"
    return base
def prog_eng(w):
    """锐树网课：把周内容拆成周一/三/五三天箭头"""
    r = RUISHU[w]
    days = [ruishu_daily(r, i) for i in range(3)]
    return " → ".join(days)
def prog_kk(w):
    """库课2000题：B日三天题号段"""
    sect = section(w)
    return f"{sect}·第1-5题 → 第6-10题 → 第11-15题+总复习"
def prog_read(w):
    """四级阅读：A/B日拆分"""
    u1, u2 = 2*w-1, 2*w
    return f"A日: Unit{u1}·2篇 → Unit{u2}·2篇 → 错题重做<br>B日: Unit{u1}·3篇 → Unit{u2}·3篇 → 4篇+错题"
def prog_listen(w):
    """四级听力：A/B日拆分"""
    d1, d2 = 2*w-1, 2*w
    return f"A日: Day{d1}短新闻+长对话 → Day{d2}短文+讲座 → 错题重听<br>B日: Day{d1}完整训练 → Day{d2}完整训练 → 关键词默写"
prog = ["| 周次 | 起止 | 同济高数（周一→周三→周五） | 锐树网课（周一→周三→周五） | 库课2000题（周二→周四→周六） | 四级阅读（A日/B日） | 四级听力（A日/B日） | 周日模考 |",
        "|---|---|---|---|---|---|---|---|"]
for w in range(1, 30):
    prog.append(f"| {w} | {week_range(w)} | {prog_math(w)} | {prog_eng(w)} | {prog_kk(w)} | {prog_read(w)} | {prog_listen(w)} | {sunday_exam(w)} |")
prog_md = "\n".join(prog)

# ---- 首周计划表（7 列）----
FIRST_WEEK = """| 星期/日类型 | 高数（同济+库课18套） | 专升本英语（锐树网课+库课） | 四级阅读（新东方） | 四级听力（新东方） | 词汇（不背单词APP四级词本+默写本） | 机动复盘 |
|---|---|---|---|---|---|---|
| 09-04 周五（A） | 同济第1章 §1.1函数概念与性质（映射/复合/反函数，约P1–15）自学→库课第1套2道概念题。验收：例题复现≥80%，2题步骤完整 | 锐树网课《入门课》（67分钟，可分2次看）→库课2000题词汇语法练习。验收：标重点+错题标注 | 新东方Unit1 Passage1-2 限时8min/篇。验收：每篇标3关键词+定位句+≥60% | Day1 短新闻×2+长对话×1。验收：盲听→对照→影子跟读2遍→默写3句 | 不背单词APP四级词本新35词+复习。验收：APP每日35词清零 | 开启动员：整理高数概念卡+锐树网课笔记归类，写1条改进 |
| 09-05 周六（B） | 错题回顾+库课第1套2道新大题。验收：错题会做，新题步骤完整 | 库课2000题词汇语法约15题。验收≥65% | 新东方Unit1 Passage3-4+复习P1-2生词（60min）。验收≥60% | Day2 短新闻+长对话+篇章（60min）。验收影子跟读2遍+默写3句 | 不背单词APP四级词本新35词+复习 | 刘晓燕技巧书第1节（定位法）或高数错题归因 |
| 09-06 周日（模考·数学） | 〔数学模考·同济第1章阶段自测〕2h（总习题，按150分估）+错题归因。验收：记录估分与错题 | 不安排（今日休专升本英语） | 不安排 | 不安排 | 不背单词APP刷系统复习+默写本易错词听写（30min） | 全周错题汇总（数学+英语+四级）分类归因+写下周改进；进度自查完成率≥85% |
| 09-07 周一（A） | 同济§1.2数列极限概念（定义/性质，约P15–22）→库课第1套2题。验收≥80% | 锐树网课《名词（一）》（44分钟）。验收：笔记+错题标注 | 新东方Unit2 Passage1-2 限时8min/篇。验收≥60% | Day1 复习跟读+补默写（30min） | 不背单词APP四级词本新35词+复习 | 整理高数错因（概念/计算/审题分类） |
| 09-08 周二（B） | 错题回顾+库课第1套2道新大题。验收步骤完整 | 库课「词汇语法」约15题。验收≥65% | 新东方Unit2 Passage3-4+复习（60min） | Day2 复习跟读（60min） | 不背单词APP四级词本新35词+复习 | 刘晓燕技巧书第2节（预读技巧） |
| 09-09 周三（A） | 同济§1.3函数极限+极限运算法则（单侧极限/存在判定，约P22–30）→库课第1套2题。验收≥80% | 锐树网课《名词（二）》（24分钟）+库课词汇语法练习。验收≥65% | 新东方Unit1-2 复习生词+限时重做错题（2篇） | Day1-2 影子跟读（30min） | 不背单词APP四级词本新35词+复习 | 回顾本周视频（入门课/名词）笔记+语法考点 |
| 09-10 周四（B） | 错题回顾+库课第1套2道新大题。验收步骤完整 | 库课「词汇语法」约15题+本周词汇语法错题整理。验收≥65% | 新东方Unit2 复习+限时重做（60min） | Day1-2 影子跟读（60min） | 不背单词APP四级词本新35词+复习 | 刘晓燕技巧书第3节；整理本周高数/英语错题 |
"""

PROSE = r"""# 湖北专升本 + CET4 双轨备考执行方案（2026-09-04 起）

> 学生：湖北省高职三年级专科生 · 目标院校：湖北工程学院·应用数学专业
> 执行起点：2026-09-04（周五，由 09-02 顺延开始）· 每日固定 4 小时（240 分钟）· 白天无课无干扰 · 当前 CET4 词汇量约 2500、语法弱、听力/阅读正确率<50%

## 〇、关键日期核实（重要，请先读）

我用历法核对了关键日期，有 **2 处与你写的「惯例档期」冲突**，方案已按你给的日期锚定，并给出平移动议：

| 你给的日期 | 实际星期 | 说明 |
|---|---|---|
| 2026-12-12（CET4 笔试） | **周六** | 与你确认一致（周六）。锚定 2026-12-12 为考试日，考前以准考证为准；日期平移不影响周循环结构。 |
| 2027 年专升本（参考 2026 年：报名 3/10-13、考试 4/17） | 2027-04-17=**周六** | 按 2026 年节奏，2027 年考试大概率在 **4 月中旬**；本方案锚定 **2027-04-17（周六）** 为考试日、报名约 **3 月上旬**，均以湖北省教育考试院 2027 年通知为准，日期平移不影响周循环结构。 |

其余日期核实无误：2026-10-01=周四（国庆）、2027-01-01=周五（元旦）、2027-02-06=周六（春节正月初一）、2027-02-28=周日。

## 关于「页码/题号」的定位规则（一次性说明）

实体书页码随印次不同，无法替你看书定位。本方案统一用「**章→节 / 单元 / 题号区间 / 套卷 / Day**」作稳定定位（可直接对应实体书目录）；同济教材另给**近似页码区间**（约 P 起止，标「以目录为准」）。第一次使用时翻开目录，把「章节/单元/题号」映射到你书上的起始页即可。锐树网课按「讲次/专项名」定位。

---

## 一、备考阶段与每日 4 小时时间分配

### 阶段时间轴

| 阶段 | 区间 | 核心目标 |
|---|---|---|
| 阶段一 · CET4 优先期 | 2026-09-04 ~ 12-11 | 四级保 450，数学/专升本英语同步起步 |
| 阶段二 · 专升本基础巩固期 | 2026-10-01 ~ 12-31 | 与阶段一重叠；10月起数学/专升本英语系统推进 |
| 阶段三 · 专升本强化突破期 | 2027-01-01 ~ 02-28 | CET4 已考，全力数学+专升本英语 |
| 阶段四 · 专升本冲刺模考期 | 2027-03-01 ~ 04-17（考前） | 全真模考+错题清零；3 月报名窗口 |

### 每日时间分配（A/B/周日，共 240 分钟）

| 模块 | 周一/三/五（A类日） | 周二/四/六（B类日） | 周日（模考日） |
|---|---|---|---|
| 高等数学（同济+库课18套） | 60 min | 30 min（错题+2新大题） | 隔周完整模考 2h |
| 专升本英语（锐树网课+库课2000题） | 60 min | 30 min | 不安排 |
| 四级阅读（新东方800题/闪过） | 30 min | 60 min | 隔周四级模考 2h |
| 四级听力（新东方600题/闪过） | 30 min | 60 min | 不安排 |
| 词汇（不背单词APP四级词本+默写本） | 45 min | 45 min | 30 min（复习本周） |
| 机动复盘 | 15 min | 15 min | 复盘+下周计划 |

> 锐树网课节奏说明：**每周只学 1 个新讲次**（该周第一个 A 类日学新讲，其余 A 类日做库课对应练习+难点回看），保证「听讲→刷题」闭环，也正好对齐里程碑（语法 12 讲 11/24 前看完、全专项 01/19 前看完）；库课 2000 题按「约 100 题/周」推进，紧跟锐树网课专项。

### 词汇策略（艾宾浩斯记忆法 + 间隔重复 + 主动回忆）

> 现状：四级词本 4755 词、已学 1456；目标 2026-12-12 前过完 2 轮（第1轮学完 + 第2轮系统复习）。

**三条记忆方法（每日执行）**

1. **主动回忆 Active Recall**：新词先看英文→遮住中文→闭眼回忆→再揭晓；想不起来的点「陌生」，当天重点重看。
2. **间隔重复 Spaced Repetition**：不背单词APP 按艾宾浩斯遗忘曲线，自动在「学后 1/2/4/7/15/30 天」推送复习；当天只做 APP 推送的复习，不手动堆量。
3. **主动输出**：11-16 起用闪过默写本 20 词听写（写出来验证）；12 月系统复习期回炉真题生词。

| 阶段 | 时间 | 任务 |
|---|---|---|
| 第1轮·新词期 | 09-04 ~ 12-05 | 每日新学 **35 词**（主动回忆 + APP 间隔重复） |
| 第2轮·系统复习期 | 12-06 ~ 12-11 | 纯复习：APP 复习 + 默写本 20 词 + 真题生词回炉 |

| 项 | 安排 |
|---|---|
| 每日新词 | **35 词**（含 APP 自动复习，约 45 分钟） |
| 第1轮截止 | 约 **12-05** 学完全 4755 词，提前留出 6 天复习 |
| 验收 | 每日 APP「35 新词」任务清零；周末生词听写正确率 ≥85% |

> 算账：4755 - 1456 = 3299 词；3299 ÷ 约 93 天 ≈ 35 词/天，12-05 前学完第 1 轮，留 12-06~12-11 共 6 天做系统复习（第 2 轮）。

### CET4 考后（2026-12-13 起）槽位重分配（总时长仍 240 分钟）

| 原四级槽位 | 12-13 起去向 |
|---|---|
| 四级阅读（A30+B60） | → 专升本英语阅读+完形（库课2000题） |
| 四级听力（A30+B60） | → 高等数学强化 + 专升本翻译/写作 |
| 周日偶数周四级模考 | → 专升本英语历年真题/考前模拟题模考（2020-2026年 + 考前模拟2套） |
| 词汇（四级默写本＋不背单词APP） | → 四级默写本停用；不背单词APP切「专升本级词书」+专升本高频词 |

---

## 二、首周详细周计划表（2026-09-04 ~ 09-10）

""" + FIRST_WEEK + """

---

## 三、后续周滚动模板（自第2周起，每周套用）

### 3.1 周模板（空表结构，按下方 3.2 填章节/讲次/题号）

| 星期/日类型 | 高数 | 专升本英语（锐树网课+库课） | 四级阅读 | 四级听力 | 词汇（不背单词APP四级词本+默写本） | 机动复盘 |
|---|---|---|---|---|---|---|
| 周一（A） | 同济「本周章节」自学+库课2大题 | 锐树网课「本周新讲」20–25min→库课「本周专项」约20题 | 新东方「本周Unit」2篇 | 新东方「本周Day」 | 不背单词APP四级词本新35词+复习 | 锐树网课笔记回顾 |
| 周二（B） | 错题+库课2新大题 | 库课「本周专项」约15题巩固 | 「本周Unit」4篇 | 「本周Day」 | 不背单词APP四级词本新35词+复习 | 刘晓燕1节/错题归因 |
| 周三（A） | 同济续讲+库课2大题 | 锐树网课难点回看+库课约25题 | 2篇 | 1套 | 不背单词APP四级词本新35词+复习 | 机动 |
| 周四（B） | 错题+2新大题 | 库课约15题巩固 | 4篇 | 1套 | 不背单词APP四级词本新35词+复习 | 机动 |
| 周五（A） | 同济续讲+库课2大题 | 库课约25题+笔记整理 | 2篇 | 1套 | 不背单词APP四级词本新35词+复习 | 机动 |
| 周六（B） | 错题+2新大题 | 库课约15题巩固 | 4篇 | 1套 | 不背单词APP四级词本新35词+复习 | 机动 |
| 周日（模考） | 隔周：数学完整卷 / 四级真题（CET4前） | 不安排 | 隔周四级模考 | 不安排 | 不背单词APP刷系统复习（30min） | 错题归因+下周计划+进度自查 |

### 3.2 内容推进表（30 周 → 章节/讲次/模考，与月度打卡表逐日标签一一对应）

""" + prog_md + """

### 3.3 每周固定循环事项（必须执行）

| 项目 | 频次 | 验收标准 |
|---|---|---|
| 周日模考 | 隔周（CET4前数学/四级交替；考后数学/英语交替） | 数学 150 分制、四级 710 分制估分，记录各板块得分+错题归因 |
| 错题周复盘 | 每周日 | 数学+英语+四级错题汇总分类，写共性问题+下周策略；专升本英语错题标注锐树网课讲次编号 |
| 进度自查 | 每周日 | 完成率<85% 则周一补做并写原因 |

---

## 四、资料使用频次统计（确保无闲置）

| 资料 | 每周频次 | 使用定位 | 全周期用量 |
|---|---|---|---|
| 同济《高等数学》少学时版第3版 | 每周 6 天（A/B日自学） | 概念+例题自学（唯一数学输入源） | 6 章约 30 周，逐章啃完 |
| 库课《高数18套》 | A/B日每日2大题 + 周日卷 | 章节大题训练 + 完整模考 | 每章≥10大题（12-10前）+18套卷 |
| 锐树网课网校专升本英语精讲 | 每周 1 讲（周一 A日，20–25min）+周三/五回看 | 唯一专升本英语视频源 | 语法12讲+阅读/完形/翻译/写作各2讲 |
| 库课《专升本必刷2000题》 | 每周 6 天跟练（约100题/周） | 紧跟锐树网课「听讲→刷题」闭环 | 2000题一轮+二刷错题 |
| 闪过《四级真题》 | 偶数周周日 1 套 | 套卷模考（估710） | 6套+冲刺模拟 |
| 闪过《四级词汇默写本》 | 11-16 起每日 20 词听写 | 与闪过真题同源（独立词库） | 前期不用，四级复习阶段启用 |
| 新东方《四级阅读800题》 | A日2篇+B日4篇（每周18篇） | 限时阅读训练 | 590 基础+210 冲刺 |
| 新东方《四级听力600题》 | 每周约2 Day（影子跟读+默写） | 短新闻/长对话/篇章 | 30 Day 过完（约15周） |
| 学丞《刘晓燕四级技巧》 | 每周 1–2 节（机动） | 定位法/预读等技巧补充 | 全书考点过完 |
| 不背单词APP | 每日新35词+系统复习 | 唯一词汇APP（四级词本，12-13起切专升本词本） | 12-12前学完4755词本+系统复习=2轮 |

---

## 五、周复盘模板（每周日填写）

| 项目 | 填写内容 |
|---|---|
| 本周完成率 | __/7 天 = __%（<85% 说明原因+周一补做计划） |
| 高数错题数 | 概念 __· 计算 __· 审题 __（共 __ 题）→ 共性： |
| 锐树网课进度 | ☐ 语法第__讲 ☐ 阅读/完形/翻译/写作专项第__讲（勾选已完成） |
| 库课2000题 | 本周 __ 题·正确率 __%·错误考点： |
| 四级阅读/听力 | 阅读正确率 __%·听力正确率 __%·主要失分题型： |
| 词汇 | 不背单词APP四级词本 __/4755·本周新词 __·默写本正确率 __%·生词 __ 个（已入下周复习：☐） |
| 周日模考分 | 数学 __/150 或 四级 __/710·失分板块： |
| 共性问题 | （1行概括本周最大短板） |
| 下周调整 | （1条可执行的改进，例：导数求导法则每天早读背1遍） |
| 锐树网课重点回看 | 下周需回看的讲次清单： |

---

## 六、月度每日打卡计划表（可直接导入 Excel）

> **导入方法**：复制下方任一「月度表格」的列内容（含表头与分隔行），粘贴到 Excel → 选中区域 →「数据」→「分列」（分隔符 `|`）。本方案的 `.xlsx` 文件已内置**下拉勾选 + 完成率/优先级自动统计公式**（可直接打卡）。勾选框在 Excel 中建议替换为「数据验证→序列」或「条件格式」。

[[MONTHLY_TABLES]]

---

## 七、里程碑与节假日清单

**里程碑**
- 2026-12-05 前：不背单词APP四级词本学完全 4755 词（第 1 轮）；12-06~12-11 系统复习巩固（第 2 轮）
- 2026-11-30 前：四级模拟 ≥380（闪过真题模考）
- 2026-12-10 前：数学完成同济前5章 + 库课18套每章≥10题；锐树网课语法部分看完
- 2027-01-31 前：库课18套数学正确率≥70%；锐树网课全部专项（语法/阅读/完形/翻译/写作）看完
- 2027-02-28 前：专升本模考 ≥340（库课18套完整卷）
- 2027-03-10~13：专升本网上报名（参考 2026 年时间，留意官方通知，不影响学习）
- 考前一周（约 2027-04-10）：模考稳定 ≥360，提交易错清单（含锐树网课重点回看目录）

**节假日（减半，约 2 小时）**：2026-10-01（国庆）、2027-01-01（元旦）、**2027-02-05~11（春节）**——各模块时长减半、单词照常，不计入完成率缺口。

**专升本报名/考试**（参考 2026 年）：报名 2027-03-10～13，考试 2027-04-17（周六，以湖北省教育考试院 2027 年通知为准）。

---

*本方案由「周计划表（首周已填+周模板）+月度打卡表（7个月）+内容推进表」三层构成，三线并行互不干扰；严格执行三条强制逻辑链：①锐树网课(先听)→库课2000题(跟练)→错题回锐树网课笔记；②同济教材(自学)→库课18套(章节大题)→周日完整模考；③新东方专项(逐篇)→闪过真题(套卷)→刘晓燕(查漏补缺)。*
"""

final_md = PROSE.replace("[[MONTHLY_TABLES]]", monthly_md)
md_path = os.path.join(BASE, "专升本_英语四级_双轨备考执行方案.md")
with open(md_path, "w", encoding="utf-8") as f:
    f.write(final_md)

def dw(s): return sum(2 if ord(c) > 127 else 1 for c in s)  # 全角=2 半角=1

# ---- xlsx ----
wb = Workbook()
ss = wb.active; ss.title = "月度汇总"
STATUS = '"☑ 已完成,☐ 未完成"'; PRIO = '"高,中,低"'
PRIO_FILL = {"高": PatternFill("solid", fgColor="FFC7CE"),
             "中": PatternFill("solid", fgColor="FFEB9C"),
             "低": PatternFill("solid", fgColor="C6EFCE")}
HDR_FILL = PatternFill("solid", fgColor="4472C4"); HDR_FONT = Font(bold=True, color="FFFFFF")
thin = Side(style="thin", color="D9D9D9"); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
sum_headers = ["月份","已完成","未完成","完成率"]
for c,h in enumerate(sum_headers,1):
    cell = ss.cell(1,c,h); cell.fill=HDR_FILL; cell.font=HDR_FONT
    cell.alignment=Alignment(horizontal="center"); cell.border=BORDER
r = 2
HEADERS2 = ["日期","星期","计划事项","任务完成","完成率","实际完成时间","备注"]
COLW2 = [12,6,68,10,11,14,22]
for (y,m,rows) in months:
    sn = f"{y}-{m:02d}"; ws = wb.create_sheet(sn)
    for c,h in enumerate(HEADERS2,1):
        cell=ws.cell(1,c,h); cell.fill=HDR_FILL; cell.font=HDR_FONT
        cell.alignment=Alignment(horizontal="center",vertical="center"); cell.border=BORDER
    dv_t=DataValidation(type="list",formula1=STATUS,allow_blank=False,showDropDown=False)
    dv_p=DataValidation(type="list",formula1=PRIO,allow_blank=False,showDropDown=False)
    ws.add_data_validation(dv_t); ws.add_data_validation(dv_p)
    rr = 2
    for day_idx,(d,wd,summ,rk) in enumerate(rows):
        tasks = [t for t in summ.split("｜") if t] or [summ]
        ds = rr
        for ti,task in enumerate(tasks):
            if ti == 0:
                dc=ws.cell(rr,1,d.strftime("%Y-%m-%d")); dc.number_format="yyyy-mm-dd"; dc.font=Font(bold=True); dc.alignment=Alignment(horizontal="center",vertical="center")
                bc=ws.cell(rr,2,wd); bc.font=Font(bold=True); bc.alignment=Alignment(horizontal="center",vertical="center")
                ws.cell(rr,6,None).alignment=Alignment(horizontal="center",vertical="center")
                rc=ws.cell(rr,7,rk); rc.alignment=Alignment(wrap_text=True,horizontal="center",vertical="center")
            tp = task_priority(task, d)
            tc=ws.cell(rr,3,task.strip()); tc.alignment=Alignment(wrap_text=True,horizontal="left",vertical="top"); tc.fill=PRIO_FILL.get(tp, PatternFill())
            sc=ws.cell(rr,4,"☐ 未完成"); sc.alignment=Alignment(horizontal="center",vertical="center")
            rr += 1
        de = rr - 1
        pct=ws.cell(ds,5, f'=COUNTIF(D{ds}:D{de},"☑ 已完成")/COUNTA(C{ds}:C{de})')
        pct.number_format="0%"; pct.font=Font(bold=True); pct.alignment=Alignment(horizontal="center",vertical="center")
        day_fill = None  # 任务按独立优先级填色，不再用交替底色
        if de > ds:
            for col in (1,2,5,6,7):
                ws.merge_cells(start_row=ds,start_column=col,end_row=de,end_column=col)
        for r2 in range(ds, de+1):
            for c in (3,4):
                cell=ws.cell(r2,c)
                cell.border = BORDER
                if day_fill is not None:
                    cell.fill = day_fill
            if r2 == ds:
                for c in (1,2,5,6,7):
                    ws.cell(r2,c).border = BORDER
                if day_fill is not None:
                    for c in (1,2,5,6,7):
                        ws.cell(r2,c).fill = day_fill
            n_lines = max(1, math.ceil(dw(ws.cell(r2,3).value or "")/56))
            ws.row_dimensions[r2].height = n_lines*16 + 4
    last = rr - 1
    dv_t.add(f"D2:D{last}")
    ws.freeze_panes="A2"
    for c,wdt in enumerate(COLW2,1):
        ws.column_dimensions[get_column_letter(c)].width=wdt
    ws.cell(last+2,1,"月度汇总").font=Font(bold=True)
    labels=[("已完成",f'=COUNTIF(D2:D{last},"☑ 已完成")'),
            ("未完成",f'=COUNTIF(D2:D{last},"☐ 未完成")'),
            ("完成率",f'=COUNTIF(D2:D{last},"☑ 已完成")/(COUNTIF(D2:D{last},"☑ 已完成")+COUNTIF(D2:D{last},"☐ 未完成"))')]
    for j,(lab,fm) in enumerate(labels):
        ws.cell(last+3+j,1,lab).font=Font(bold=True)
        fc=ws.cell(last+3+j,2,fm)
        if lab=="完成率": fc.number_format="0.0%"
    ss.cell(r,1,sn)
    ss.cell(r,2,f'=COUNTIF(\'{sn}\'!D2:D1000,"☑ 已完成")')
    ss.cell(r,3,f'=COUNTIF(\'{sn}\'!D2:D1000,"☐ 未完成")')
    ss.cell(r,4,f"=B{r}/(B{r}+C{r})").number_format="0.0%"
    for c in range(1,5): ss.cell(r,c).border=BORDER
    r+=1
ss.cell(r,1,"合计")
ss.cell(r,2,f"=SUM(B2:B{r-1})"); ss.cell(r,3,f"=SUM(C2:C{r-1})")
ss.cell(r,4,f"=B{r}/(B{r}+C{r})").number_format="0.0%"
for c in range(1,5): ss.cell(r,c).font=Font(bold=True); ss.cell(r,c).border=BORDER
r += 2
tc = ss.cell(r, 1, "任务倒计时")
tc.font = Font(bold=True, size=13, color="C00000")
tc.alignment = Alignment(horizontal="center", vertical="center")
ss.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
r += 1
for c, h in enumerate(["考试", "日期", "剩余天数"], 1):
    cell = ss.cell(r, c, h)
    cell.fill = HDR_FILL; cell.font = HDR_FONT
    cell.alignment = Alignment(horizontal="center"); cell.border = BORDER
ss.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
r += 1
for name, dstr in [("CET4", "2026-12-12"), ("专升本", "2027-04-17")]:
    nc = ss.cell(r, 1, name)
    nc.font = Font(bold=True)
    nc.alignment = Alignment(horizontal="center", vertical="center")
    ss.cell(r, 2, dstr).alignment = Alignment(horizontal="center")
    _c = ss.cell(r, 3, f"=DATE({dstr[:4]},{int(dstr[5:7])},{int(dstr[8:])})-TODAY()")
    _c.number_format = '0'
    _c.font = Font(bold=True, color="C00000")
    _c.alignment = Alignment(horizontal="center")
    ss.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
    for col in range(1, 5):
        ss.cell(r, col).border = BORDER
    r += 1

ss.freeze_panes="A2"
for c,wdt in enumerate([12,12,12,12],1): ss.column_dimensions[get_column_letter(c)].width=wdt
wb.calculation.fullCalcOnLoad=True
xlsx_path=os.path.join(BASE,"专升本_英语四级_月度打卡表.xlsx")
try:
    wb.save(xlsx_path)
except PermissionError:
    import time as _t
    xlsx_path=os.path.join(BASE,f"专升本_英语四级_月度打卡表_{_t.strftime('%H%M%S')}.xlsx")
    wb.save(xlsx_path)
    print("[提示] 原文件被占用，已另存为:", xlsx_path)

print("md:", os.path.getsize(md_path), "字节 | xlsx:", os.path.getsize(xlsx_path), "字节 | 总天数:", len(days))
for (y,m,g) in months: print(f"  {y}-{m:02d}: {len(g)}天")
print("抽样 A日:", days[0][2][:60], "…")
print("抽样 B日:", days[1][2][:60], "…")
print("抽样 周日:", days[4][2])
print("抽样 12-13(考后):", [x[2] for x in days if x[0]==datetime.date(2026,12,13)][0])
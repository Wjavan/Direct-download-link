# -*- coding: utf-8 -*-
"""生成 专升本+CET4 备考计划打卡表 (xlsx)"""
from datetime import date, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

START = date(2026, 9, 2)
END = date(2027, 3, 29)
CET4_DAY = date(2026, 12, 14)
WD = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

# ---------- 模板任务（每条一行） ----------
TPL_P_STD = [
    "07:00-07:40｜专升本英语词汇手册（掌握20词，默写≥90%）",
    "08:00-11:00｜专升本数学（当前章节+《1000题》20题，正确率≥70%）",
    "11:10-11:40｜CET4扇贝单词30新词",
    "14:00-15:30｜CET4听力四步法（默写≥8句）",
    "15:40-16:40｜CET4阅读限时8分钟（标3关键词+定位句）",
    "19:00-20:30｜专升本英语语法+阅读（正确率≥60%）",
    "20:40-21:10｜错题复盘三栏笔记",
]
TPL_P_WED = [
    "07:00-07:40｜专升本英语词汇手册",
    "08:00-11:00｜专升本数学（章节+《1000题》）",
    "14:00-16:40｜CET4整套限时模拟（记录总分+题型得分）",
    "16:50-17:20｜模拟对答案初判",
    "19:00-20:30｜专升本英语复习+阅读",
    "20:40-21:10｜扇贝复习打卡",
]
TPL_P_SAT = [
    "07:00-07:40｜专升本英语词汇手册",
    "08:00-11:00｜数学专题训练（≥20题，正确率≥70%）",
    "11:10-11:40｜CET4扇贝单词30新词",
    "14:00-15:30｜CET4听力四步法",
    "15:40-16:40｜CET4阅读限时",
    "19:00-20:30｜专升本英语",
    "20:40-21:10｜本周专题错题归总",
]
TPL_P_SUN = [
    "07:00-07:40｜专升本英语词汇手册",
    "08:00-11:00｜专升本数学",
    "14:00-16:40｜CET4整套限时模拟（本周第2次）",
    "16:50-17:50｜本周错题三栏笔记",
    "19:00-20:00｜专升本英语阅读+词汇",
    "20:00-21:30｜周日复盘（核对进度表，完成率<85%周一补做）",
]
TPL_S_STD = [
    "07:00-07:40｜专升本英语词汇（4500+高频）",
    "08:00-12:00｜专升本数学二轮专题/真题（20题，正确率≥70%）",
    "14:00-15:00｜专升本英语阅读限时（正确率≥70%）",
    "15:10-16:10｜专升本英语写作仿写≥150词",
    "19:00-21:00｜数学真题分块限时+错题归因",
]
TPL_S_WED = [
    "07:00-07:40｜专升本英语词汇",
    "08:00-12:00｜数学真题整卷限时模考",
    "14:00-16:00｜英语真题整卷限时模考",
    "19:00-21:00｜两科错题归因+策略优化",
]
TPL_S_SAT = [
    "07:00-07:40｜专升本英语词汇",
    "08:00-12:00｜数学二轮专题强化（≥20题）",
    "14:00-15:30｜英语阅读专项2篇",
    "15:40-16:40｜英语写作仿写≥150词",
    "19:00-21:00｜本周错题归总+更新易错清单",
]
TPL_S_SUN = [
    "07:00-07:40｜专升本英语词汇",
    "08:00-12:00｜数学真题整卷模考（第2套）",
    "14:00-16:00｜英语真题整卷模考（第2套）",
    "16:10-17:40｜本周错题三栏笔记",
    "19:00-20:00｜词汇+阅读复习",
    "20:00-21:30｜周日复盘（核对进度表）",
]

# ---------- 特殊日 ----------
BUFFER = {  # 弹性缓冲日 -> 低优先级，完全替换
    date(2026,10,1): "国庆弹性缓冲（任务顺延，10-02补回）",
    date(2026,12,25): "圣诞弹性缓冲（任务顺延，12-26补回）",
    date(2026,12,26): "圣诞弹性缓冲（任务顺延，12-27补回）",
    date(2026,12,27): "圣诞弹性缓冲（任务顺延，12-28补回）",
    date(2027,1,1): "元旦弹性缓冲（任务顺延，01-02补回）",
}
EXAM_DAY = {  # 考试日 -> 高优先级，完全替换
    date(2026,12,14): "【CET4考试日】考试+考后复盘（当日不安排新任务）",
    date(2027,3,15): "【专升本候选考试日·候选1】考试+复盘",
    date(2027,3,22): "【专升本候选考试日·候选2】考试+复盘",
    date(2027,3,29): "【专升本候选考试日·候选3】考试+复盘",
}
MILESTONE = {  # 里程碑/月模考 -> 高优先级，前置任务（叠加在当日模板前）
    date(2026,10,12): "【月模考】CET4 2024年6月真题整套限时模拟（24h内交总分+错题分布）",
    date(2026,11,9): "【月模考】CET4 2023年12月真题整套限时模拟（24h内交总分+错题分布）",
    date(2026,11,30): "【里程碑】CET4模拟成绩≥380（附截图/成绩表）",
    date(2026,12,10): "【里程碑】数学一轮8章复习完成（8章目录+每章≥50题）",
    date(2027,1,12): "【月模考】湖北专升本2024真题（数学+英语合卷）",
    date(2027,1,31): "【里程碑】数学二轮完成，真题正确率≥70%（附《1000题》第3-6章统计）",
    date(2027,2,16): "【月模考】湖北专升本2023真题（数学+英语合卷）",
    date(2027,2,28): "【里程碑】专升本模考≥340（附2023/2024真题成绩）",
    date(2027,3,20): "【里程碑】模考稳定≥360（连续2次），提交《易错清单V1.0》",
}

def get_plan(d):
    """返回 (任务列表, 优先级, 备注)"""
    # 考试日
    if d in EXAM_DAY:
        return [EXAM_DAY[d]], "高", "考试日，无新任务"
    # 缓冲日
    if d in BUFFER:
        return [BUFFER[d]], "低", "弹性缓冲，次日补回"
    # 正常学习日
    wd = d.weekday()
    sprint = d >= CET4_DAY
    if sprint:
        if wd == 2:
            tasks = list(TPL_S_WED)
        elif wd == 5:
            tasks = list(TPL_S_SAT)
        elif wd == 6:
            tasks = list(TPL_S_SUN)
        else:
            tasks = list(TPL_S_STD)
    else:
        if wd == 2:
            tasks = list(TPL_P_WED)
        elif wd == 5:
            tasks = list(TPL_P_SAT)
        elif wd == 6:
            tasks = list(TPL_P_SUN)
        else:
            tasks = list(TPL_P_STD)
    prio = "中"
    note = ""
    if d in MILESTONE:
        tasks = [MILESTONE[d]] + tasks
        prio = "高"
        note = "当日含里程碑/月模考，须当日完成，不可顺延"
    return tasks, prio, note

# ---------- 构建行数据（按月份分组） ----------
month_rows = {}  # key=(year,month) -> list of (date, wd, tasks, prio, note)
d = START
while d <= END:
    tasks, prio, note = get_plan(d)
    key = (d.year, d.month)
    month_rows.setdefault(key, []).append((d, WD[d.weekday()], tasks, prio, note))
    d += timedelta(days=1)

months_sorted = sorted(month_rows.keys())

# ---------- 样式 ----------
HEADER_FILL = PatternFill("solid", fgColor="2F5597")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
BODY_FONT = Font(size=10)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
PRIO_FILL = {"高": PatternFill("solid", fgColor="FFC7CE"),
             "中": PatternFill("solid", fgColor="FFEB9C"),
             "低": PatternFill("solid", fgColor="C6EFCE")}

STATUS_OPTS = '"☑ 完成,◐ 部分,☐ 未完成"'
PRIO_OPTS = '"高,中,低"'

COL_WIDTHS = {"A": 12, "B": 7, "C": 64, "D": 12, "E": 9, "F": 16, "G": 22}
HEADERS = ["日期", "星期", "计划事项", "完成状态", "优先级", "实际完成时间", "备注"]

wb = openpyxl.Workbook()

# ---------- 每月明细 sheet ----------
for key in months_sorted:
    y, m = key
    sheet_name = f"{y}-{m:02d}"
    ws = wb.create_sheet(sheet_name)
    for col, w in COL_WIDTHS.items():
        ws.column_dimensions[col].width = w
    # 表头
    for j, h in enumerate(HEADERS, 1):
        c = ws.cell(row=1, column=j, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = CENTER
        c.border = BORDER
    # 数据行
    rows = month_rows[key]
    r = 2
    for (dt, wd, tasks, prio, note) in rows:
        ws.cell(r, 1, dt.strftime("%Y-%m-%d")).alignment = CENTER
        ws.cell(r, 2, wd).alignment = CENTER
        ws.cell(r, 3, "\n".join(tasks)).alignment = WRAP
        sc = ws.cell(r, 4, "☐ 未完成"); sc.alignment = CENTER
        pc = ws.cell(r, 5, prio); pc.alignment = CENTER
        pc.fill = PRIO_FILL[prio]
        ws.cell(r, 6, "").alignment = CENTER
        ws.cell(r, 7, note).alignment = WRAP
        for j in range(1, 8):
            ws.cell(r, j).font = BODY_FONT
            ws.cell(r, j).border = BORDER
        # 行高按任务数
        n = len(tasks)
        ws.row_dimensions[r].height = max(15 * n + 12, 66)
        r += 1
    last = r - 1  # 最后数据行
    # 数据验证
    dv_status = DataValidation(type="list", formula1=STATUS_OPTS, allow_blank=False)
    dv_prio = DataValidation(type="list", formula1=PRIO_OPTS, allow_blank=False)
    ws.add_data_validation(dv_status); ws.add_data_validation(dv_prio)
    dv_status.add(f"D2:D{last}")
    dv_prio.add(f"E2:E{last}")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:G{last}"

# ---------- 月度汇总 sheet ----------
summary = wb.active
summary.title = "月度汇总"
summary.column_dimensions["A"].width = 12
for col in ["B","C","D","E","F","G","H","I"]:
    summary.column_dimensions[col].width = 12

# 说明区
summary["A1"] = "专升本 + CET4 备考计划月度汇总打卡表"
summary["A1"].font = Font(bold=True, size=14)
summary["A2"] = "完成率口径 =（☑完成天数 + 0.5×◐部分天数）÷ 计划天数；★打开后自动计算，勿改公式单元格。"
summary["A2"].font = Font(size=9, color="808080")
summary.merge_cells("A2:I2")

HDR_ROW = 4
SUM_HEADERS = ["月份", "计划天数", "☑完成", "◐部分", "☐未完成", "完成率", "高优先级", "中优先级", "低优先级"]
for j, h in enumerate(SUM_HEADERS, 1):
    c = summary.cell(HDR_ROW, j, h)
    c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = CENTER; c.border = BORDER

row = HDR_ROW + 1
for key in months_sorted:
    y, m = key
    sn = f"{y}-{m:02d}"
    rng = f"'{sn}'!D2:D1000"
    prng = f"'{sn}'!E2:E1000"
    arng = f"'{sn}'!A2:A1000"
    summary.cell(row, 1, f"{y}年{m}月").font = BODY_FONT
    summary.cell(row, 2, f"=COUNTA({arng})")
    summary.cell(row, 3, f'=COUNTIF({rng},"☑ 完成")')
    summary.cell(row, 4, f'=COUNTIF({rng},"◐ 部分")')
    summary.cell(row, 5, f'=COUNTIF({rng},"☐ 未完成")')
    summary.cell(row, 6, f"=(C{row}+0.5*D{row})/B{row}")
    summary.cell(row, 6).number_format = "0.0%"
    summary.cell(row, 7, f'=COUNTIF({prng},"高")')
    summary.cell(row, 8, f'=COUNTIF({prng},"中")')
    summary.cell(row, 9, f'=COUNTIF({prng},"低")')
    for j in range(1, 10):
        c = summary.cell(row, j)
        c.border = BORDER
        if j != 1:
            c.alignment = Alignment(horizontal="center", vertical="center")
    row += 1

# 全年合计
summary.cell(row, 1, "全年合计").font = Font(bold=True)
summary.cell(row, 2, f"=SUM(B{row-len(months_sorted)}:B{row-1})")
summary.cell(row, 3, f"=SUM(C{row-len(months_sorted)}:C{row-1})")
summary.cell(row, 4, f"=SUM(D{row-len(months_sorted)}:D{row-1})")
summary.cell(row, 5, f"=SUM(E{row-len(months_sorted)}:E{row-1})")
summary.cell(row, 6, f"=(C{row}+0.5*D{row})/B{row}")
summary.cell(row, 6).number_format = "0.0%"
for j in range(7, 10):
    summary.cell(row, j, f"=SUM({get_column_letter(j)}{row-len(months_sorted)}:{get_column_letter(j)}{row-1})")
for j in range(1, 10):
    c = summary.cell(row, j)
    c.border = BORDER
    c.font = Font(bold=True)
    if j != 1:
        c.alignment = Alignment(horizontal="center", vertical="center")

wb.calculation.fullCalcOnLoad = True

OUT = r"C:\Users\JAVA\Documents\Hermes\专升本+CET4备考计划打卡表.xlsx"
wb.save(OUT)
print("saved:", OUT)
print("sheets:", wb.sheetnames)
print("rows per month:", {f"{k[0]}-{k[1]:02d}": len(v) for k, v in month_rows.items()})
print("total days:", sum(len(v) for v in month_rows.values()))
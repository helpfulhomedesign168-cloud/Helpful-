import re
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "docs" / "backend" / "phase-0" / "PHASE0_BLUEPRINT.md"
OUT = ROOT / "docs" / "backend" / "phase-0" / "PHASE0_BLUEPRINT.docx"
LOGO = ROOT / "public" / "company-logo.png"
NAVY = "0D1F3A"
ORANGE = "F26B21"
BLUE = "2D6CDF"
SLATE = "44546A"
LIGHT = "F5F8FC"
CREAM = "FFF7ED"
BORDER = "D9E2EC"
FONT = "PingFang TC"
MONO = "SFMono-Regular"

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.27)
sec.page_height = Inches(11.69)
sec.top_margin = Inches(0.7)
sec.bottom_margin = Inches(0.65)
sec.left_margin = Inches(0.75)
sec.right_margin = Inches(0.75)

def set_east_asia(run, name=FONT):
    run.font.name = name
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:eastAsia"), name)
    rFonts.set(qn("w:ascii"), name)
    rFonts.set(qn("w:hAnsi"), name)

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)

def cell_margins(cell, top=70, bottom=70, left=90, right=90):
    tcPr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for key, value in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        el = OxmlElement(f"w:{key}")
        el.set(qn("w:w"), str(value))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tcPr.append(mar)

def para_shading(paragraph, fill):
    pPr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pPr.append(shd)

def add_runs(paragraph, text, size=10, color=SLATE, bold=False):
    parts = re.split(r"(\*\*.*?\*\*|`.*?`)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = MONO
            run.font.size = Pt(size - 0.8)
            run.font.color.rgb = RGBColor.from_string(NAVY)
            continue
        else:
            run = paragraph.add_run(part)
        run.bold = bold or run.bold
        run.font.size = Pt(size)
        run.font.color.rgb = RGBColor.from_string(color)
        set_east_asia(run)

def add_field(paragraph, instr):
    run = paragraph.add_run()
    fldChar = OxmlElement("w:fldChar")
    fldChar.set(qn("w:fldCharType"), "begin")
    run._r.append(fldChar)
    run2 = paragraph.add_run()
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = instr
    run2._r.append(instrText)
    run3 = paragraph.add_run()
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "separate")
    run3._r.append(fldChar2)
    run4 = paragraph.add_run("1")
    fldChar3 = OxmlElement("w:fldChar")
    fldChar3.set(qn("w:fldCharType"), "end")
    run5 = paragraph.add_run()
    run5._r.append(fldChar3)
    for r in (run, run2, run3, run4, run5):
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor.from_string("7A8797")
        set_east_asia(r)

# Base styles
styles = doc.styles
normal = styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(10)
normal.font.color.rgb = RGBColor.from_string(SLATE)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.25
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)

for name, size, color, before, after in [
    ("Heading 1", 17, NAVY, 14, 8),
    ("Heading 2", 12.5, NAVY, 10, 4),
    ("Heading 3", 10.8, ORANGE, 7, 3),
]:
    st = styles[name]
    st.font.name = FONT
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor.from_string(color)
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)

# Header/footer
header = sec.header
hp = header.paragraphs[0]
hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
hr = hp.add_run("好幫手家居裝修設計有限公司 ｜ Backend Phase 0 Blueprint")
hr.font.size = Pt(8)
hr.font.color.rgb = RGBColor.from_string("8A96A6")
set_east_asia(hr)

footer = sec.footer
fp = footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run("Backend Phase 0 ｜ 2026-11-25 ｜ 第 ")
r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string("8A96A6"); set_east_asia(r)
add_field(fp, "PAGE")
r = fp.add_run(" 頁")
r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string("8A96A6"); set_east_asia(r)

# Cover
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
p.paragraph_format.space_before = Pt(20)
if LOGO.exists():
    p.add_run().add_picture(str(LOGO), width=Inches(2.9))
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(65)
r = p.add_run("Backend Phase 0 Blueprint")
r.font.size = Pt(26); r.font.bold = True; r.font.color.rgb = RGBColor.from_string(NAVY); set_east_asia(r)
p = doc.add_paragraph()
r = p.add_run("BACKEND")
r.font.size = Pt(38); r.font.bold = True; r.font.color.rgb = RGBColor.from_string(ORANGE); set_east_asia(r)
p = doc.add_paragraph()
r = p.add_run("Direct Invoice Edition｜Backend 設計及簽核")
r.font.size = Pt(15); r.font.color.rgb = RGBColor.from_string(SLATE); set_east_asia(r)
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(18)
r = p.add_run("2026-11-25 ｜ 以 PRD v1.0 及 production e54d5b9 為基準")
r.font.size = Pt(10); r.font.color.rgb = RGBColor.from_string("7A8797"); set_east_asia(r)

# Cover summary box
table = doc.add_table(rows=1, cols=1)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
table.columns[0].width = Inches(6.8)
cell = table.cell(0, 0)
shade(cell, CREAM)
cell_margins(cell, 160, 160, 180, 180)
p = cell.paragraphs[0]
p.paragraph_format.space_after = Pt(0)
r = p.add_run("一句總結")
r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = RGBColor.from_string(ORANGE); set_east_asia(r)
p = cell.add_paragraph()
p.paragraph_format.space_after = Pt(0)
r = p.add_run("先鎖定 architecture、角色權限、資料模型、API、編號、audit 及 migration；完成 D1–D8 簽核後才開始 Phase 1。")
r.font.size = Pt(11); r.font.bold = True; r.font.color.rgb = RGBColor.from_string(NAVY); set_east_asia(r)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(40)
r = p.add_run("Phase 0 設計草案｜未開始寫 backend\nBackend 實作需以本文件簽核及 Phase 1 scaffold 為起點。")
r.font.size = Pt(8.5); r.font.color.rgb = RGBColor.from_string("7A8797"); set_east_asia(r)

doc.add_page_break()

# Contents
p = doc.add_paragraph(style="Heading 1")
r = p.add_run("目錄")
set_east_asia(r)
contents = [
    ("0", "Executive decision"),
    ("1", "Scope and assumptions"),
    ("2", "Architecture"),
    ("3", "Domain model / ERD"),
    ("4", "Roles and permissions"),
    ("5", "API contract"),
    ("6", "Business rules"),
    ("7", "Security and privacy"),
    ("8", "Migration"),
    ("9", "Environments / CI/CD"),
    ("10", "Phase plan"),
    ("11", "Phase 0 sign-off checklist"),
    ("12", "Immediate next tasks"),
]
for num, title in contents:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run(f"{num}\t{title}")
    r.font.size = Pt(11); r.font.color.rgb = RGBColor.from_string(NAVY); set_east_asia(r)

doc.add_page_break()

# Parse markdown from section 0 onward
lines = SRC.read_text().splitlines()
start = next(i for i, l in enumerate(lines) if l.startswith("## 0."))
lines = lines[start:]
i = 0
first_h1 = True
while i < len(lines):
    line = lines[i].lstrip().rstrip()
    if not line:
        i += 1
        continue
    if line.startswith("```"):
        i += 1
        block = []
        while i < len(lines) and not lines[i].startswith("```"):
            block.append(lines[i])
            i += 1
        i += 1
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.18)
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(8)
        para_shading(p, "F4F6F8")
        r = p.add_run("\n".join(block))
        r.font.name = MONO
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor.from_string(NAVY)
        continue
    if line.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            raw = lines[i].strip().strip("|")
            cells = [c.strip() for c in raw.split("|")]
            if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                rows.append(cells)
            i += 1
        if not rows:
            continue
        ncols = max(len(r) for r in rows)
        table = doc.add_table(rows=len(rows), cols=ncols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True
        table.style = "Table Grid"
        for ri, row in enumerate(rows):
            for ci in range(ncols):
                cell = table.cell(ri, ci)
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
                cell_margins(cell, 55, 55, 75, 75)
                text = row[ci] if ci < len(row) else ""
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.08
                if ri == 0:
                    shade(cell, NAVY)
                    add_runs(p, text, 8.2, "FFFFFF", True)
                else:
                    if ri % 2 == 0:
                        shade(cell, LIGHT)
                    add_runs(p, text, 8.2, SLATE, False)
        # repeat header and keep rows intact
        for row in table.rows:
            trPr = row._tr.get_or_add_trPr()
            cantSplit = OxmlElement("w:cantSplit")
            cantSplit.set(qn("w:val"), "true")
            trPr.append(cantSplit)
        tr = table.rows[0]._tr
        trPr = tr.get_or_add_trPr()
        tblHeader = OxmlElement("w:tblHeader")
        tblHeader.set(qn("w:val"), "true")
        trPr.append(tblHeader)
        doc.add_paragraph().paragraph_format.space_after = Pt(0)
        continue
    if line.startswith("## "):
        first_h1 = False
        p = doc.add_paragraph(style="Heading 1")
        p.paragraph_format.keep_with_next = True
        add_runs(p, line[3:], 17, NAVY, True)
        i += 1
        continue
    if line.startswith("### "):
        p = doc.add_paragraph(style="Heading 2")
        p.paragraph_format.keep_with_next = True
        add_runs(p, line[4:], 12.5, NAVY, True)
        i += 1
        continue
    if line.startswith("#### "):
        p = doc.add_paragraph(style="Heading 3")
        add_runs(p, line[5:], 10.8, ORANGE, True)
        i += 1
        continue
    if line.startswith("> "):
        block = []
        while i < len(lines) and lines[i].startswith(">"):
            block.append(lines[i].lstrip("> ").rstrip())
            i += 1
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        shade(cell, CREAM)
        cell_margins(cell, 100, 100, 140, 140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        add_runs(p, " ".join(block), 9, NAVY, False)
        doc.add_paragraph().paragraph_format.space_after = Pt(0)
        continue
    if line.startswith("- "):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.28)
        p.paragraph_format.first_line_indent = Inches(-0.14)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.2
        r = p.add_run("• ")
        r.font.color.rgb = RGBColor.from_string(ORANGE); r.font.size = Pt(10); set_east_asia(r)
        add_runs(p, line[2:], 9.5, SLATE)
        i += 1
        continue
    m = re.match(r"^(\d+)\.\s+(.*)$", line)
    if m:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.32)
        p.paragraph_format.first_line_indent = Inches(-0.18)
        p.paragraph_format.space_after = Pt(3)
        add_runs(p, f"{m.group(1)}.  {m.group(2)}", 9.5, SLATE)
        i += 1
        continue
    if line.strip() == "---":
        i += 1
        continue
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    add_runs(p, line, 9.7, SLATE)
    i += 1

# Core properties
props = doc.core_properties
props.title = "Backend Phase 0 Blueprint（Direct Invoice Edition）"
props.subject = "Backend architecture, roles, data model, API contract and phase plan"
props.author = "好幫手家居裝修設計有限公司"
props.keywords = "PRD, Direct Invoice, 裝修, 香港"

doc.save(OUT)
print(OUT)

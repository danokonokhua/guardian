from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = Path(r"C:\Users\okdan\Documents\ChatGPT\Guardian\docs\Guardian_Customer_Validation_Tracker.docx")

DARK_GREEN = "08634A"
PALE_GREEN = "EAF5F1"
PALE_GRAY = "F4F6F7"
MID_GRAY = "666666"
BORDER = "D9D9D9"
BLACK = RGBColor(0, 0, 0)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = borders.find(qn(f"w:{edge}"))
        if tag is None:
            tag = OxmlElement(f"w:{edge}")
            borders.append(tag)
        tag.set(qn("w:val"), "single")
        tag.set(qn("w:sz"), "4")
        tag.set(qn("w:space"), "0")
        tag.set(qn("w:color"), BORDER)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_column_width(cell, width_inches):
    cell.width = Inches(width_inches)
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_inches * 1440)))
    tc_w.set(qn("w:type"), "dxa")


def set_run_font(run, name="Aptos", size=None, bold=None, color=BLACK):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.color.rgb = color
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    set_run_font(run, size=9, color=RGBColor(90, 90, 90))
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char1, instr_text, fld_char2])


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.keep_with_next = True
    return p


def add_body(doc, text, bold_lead=None):
    p = doc.add_paragraph()
    if bold_lead and text.startswith(bold_lead):
        lead = p.add_run(bold_lead)
        lead.bold = True
        p.add_run(text[len(bold_lead):])
    else:
        p.add_run(text)
    return p


def add_bullet(doc, text, level=0):
    style = "List Bullet" if level == 0 else "List Bullet 2"
    p = doc.add_paragraph(text, style=style)
    p.paragraph_format.keep_together = True
    return p


def add_number(doc, text):
    p = doc.add_paragraph(text, style="List Number")
    p.paragraph_format.keep_together = True
    return p


def add_answer_lines(doc, count=2):
    for _ in range(count):
        p = doc.add_paragraph("________________________________________________________________________________")
        p.paragraph_format.space_after = Pt(3)
        for run in p.runs:
            run.font.color.rgb = RGBColor(150, 150, 150)
            run.font.size = Pt(9)


def add_question(doc, number, question, options=None, lines=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{number}. {question}")
    r.bold = True
    if options:
        opt = doc.add_paragraph("   ".join(f"[ ] {item}" for item in options))
        opt.paragraph_format.left_indent = Inches(0.2)
        opt.paragraph_format.space_after = Pt(6)
    if lines:
        add_answer_lines(doc, lines)


def add_table(doc, headers, rows, widths, font_size=9):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    header = table.rows[0]
    set_repeat_table_header(header)
    for i, text in enumerate(headers):
        cell = header.cells[i]
        set_column_width(cell, widths[i])
        set_cell_shading(cell, DARK_GREEN)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(text)
        set_run_font(run, size=font_size, bold=True, color=RGBColor(255, 255, 255))
    for row_index, row_data in enumerate(rows):
        row = table.add_row()
        for i, text in enumerate(row_data):
            cell = row.cells[i]
            set_column_width(cell, widths[i])
            if row_index % 2 == 1:
                set_cell_shading(cell, PALE_GREEN)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in (0, len(headers) - 1) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(str(text))
            set_run_font(run, size=font_size)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.7)
section.right_margin = Inches(0.7)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
normal.font.size = Pt(10.5)
normal.font.color.rgb = BLACK
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.line_spacing = 1.12

title = styles["Title"]
title.font.name = "Aptos Display"
title._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
title._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
title.font.size = Pt(28)
title.font.bold = True
title.font.color.rgb = BLACK
title_p_pr = title._element.get_or_add_pPr()
title_border = title_p_pr.find(qn("w:pBdr"))
if title_border is not None:
    title_p_pr.remove(title_border)

for name, size in (("Heading 1", 17), ("Heading 2", 13.5), ("Heading 3", 11.5)):
    style = styles[name]
    style.font.name = "Aptos Display"
    style._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
    style._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = BLACK
    style.paragraph_format.space_before = Pt(12)
    style.paragraph_format.space_after = Pt(6)

footer = section.footer
footer_p = footer.paragraphs[0]
footer_p.text = "Guardian Customer Validation Tracker"
footer_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
for run in footer_p.runs:
    set_run_font(run, size=9, color=RGBColor(90, 90, 90))
add_page_number(footer.add_paragraph())

p = doc.add_paragraph(style="Title")
p.add_run("Customer Validation Tracker")
subtitle = doc.add_paragraph("Guardian MVP customer validation workbook")
subtitle.paragraph_format.space_after = Pt(16)
for run in subtitle.runs:
    set_run_font(run, size=13, color=RGBColor(60, 60, 60))

add_body(
    doc,
    "Use this workbook to determine whether Guardian detects problems that matter to real businesses and explains them clearly enough to support action. Technical access confirms whether a finding is correct; the business owner confirms whether it is understandable, relevant, and useful.",
)
add_body(
    doc,
    "Current position: Guardian has completed a bounded technical audit of ten authorized public websites. Customer outcomes remain unconfirmed until an owner or authorized business operator reviews the findings.",
    bold_lead="Current position:",
)
add_body(
    doc,
    "PRD requirement: complete validation with at least 5 businesses, with 5 to 10 as the target, before major product expansion. Deployment is not required for these interviews or the local audit workflow.",
    bold_lead="PRD requirement:",
)

add_heading(doc, "How to use this workbook", 1)
for item in (
    "Obtain explicit permission before each review or website change.",
    "Run the same local, read-only audit and preserve the dated result.",
    "Verify technical findings using authorized backend access.",
    "Show the owner plain-language findings and record their answers without leading them.",
    "Only report a problem as prevented or resolved when the owner confirms the outcome and evidence.",
):
    add_number(doc, item)

add_heading(doc, "Portfolio tracker", 1)
add_body(doc, "Update the final three columns only from documented customer responses and verified outcomes.")
portfolio_rows = [
    ("1", "okapiccf.com", "Slow response snapshot; browser-protection settings", "Pending"),
    ("2", "ritssbeauty.com", "Homepage heading; browser-protection settings", "Pending"),
    ("3", "hmcng.com", "Homepage heading; browser-protection settings", "Pending"),
    ("4", "gabofarms.com", "Search visibility information and page structure", "Pending"),
    ("5", "gabogreenenergysolutions.com", "Search visibility information and page structure", "Pending"),
    ("6", "mvpterminallingllc.com", "Search-result description; browser protection", "Pending"),
    ("7", "fareharbor.com", "Sitemap redirect; browser protection", "Pending"),
    ("8", "danwebdevelopment.com", "Search visibility, sitemap, and browser protection", "Pending"),
    ("9", "nenafrika.com", "Rerun HTTP 200; 3.6-second response; prior timeout not reproduced", "Pending"),
    ("10", "africancouncilofoptometry.org", "Search visibility information and page structure", "Pending"),
]
add_table(doc, ["No", "Website", "Technical snapshot for review", "Customer status"], portfolio_rows, [0.45, 2.05, 3.8, 0.8], font_size=8.5)

doc.add_page_break()
add_heading(doc, "Validation process for each business", 1)
process = [
    ("Confirm authorization", "Record that the website owner or authorized operator has agreed to the review. Technical access does not automatically grant permission to publish feedback or change the website."),
    ("Run the baseline audit", "Run the local detailed audit, then record the date, score, coverage, critical findings, warnings, evidence, response times, and incomplete checks."),
    ("Verify technical findings", "Check the relevant website backend, CMS, hosting settings, forms, and response headers. Classify each finding as accurate, partly accurate, false positive, or incomplete evidence."),
    ("Explain the result", "Use plain language. State what Guardian observed, why it may matter, what evidence supports it, what Guardian cannot verify, and the recommended next action."),
    ("Collect owner feedback", "Ask the standard questions in this workbook. Record the owner's own words and do not suggest a preferred response."),
    ("Apply only approved changes", "Document the finding, proposed correction, approving person, and date. Do not submit live forms or alter production settings without explicit approval."),
    ("Measure the outcome", "Re-run the same check after an approved correction. Record no action, action with unknown outcome, resolved, prevented, false positive, or useful with no immediate action."),
]
for idx, (label, description) in enumerate(process, start=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_together = True
    r = p.add_run(f"{idx}. {label}. ")
    r.bold = True
    p.add_run(description)

add_heading(doc, "Initial outreach message", 1)
add_body(doc, "Copy and personalize this message:")
message = (
    "Hello [Owner's name],\n\n"
    "I am testing Guardian, a service designed to warn businesses when their website may be slow, difficult to find on Google, unavailable, insecurely configured, or unable to receive customer enquiries.\n\n"
    "I ran a limited, read-only health check on [website]. It did not change anything or submit any forms. The check found:\n\n"
    "- [Finding in plain language]\n"
    "- [Second finding in plain language]\n\n"
    "These are preliminary observations, not proof that customers or revenue have already been lost. I would like your business feedback to determine whether the information is understandable and useful.\n\n"
    "The review should take about 10 to 15 minutes. No technical knowledge is required. May I send you the results and ask a few questions?"
)
for block in message.split("\n"):
    if block.startswith("- "):
        add_bullet(doc, block[2:])
    else:
        add_body(doc, block if block else " ")

doc.add_page_break()
add_heading(doc, "Plain language findings", 1)
site_findings = [
    ("okapiccf.com", "The website took longer than Guardian's three-second target during the check. Some standard browser-protection settings also appear to be missing. This single result does not establish a continuing performance problem."),
    ("ritssbeauty.com", "Guardian could not identify a clear main heading on the homepage. This may make the page structure less clear to accessibility tools and search engines. Some standard browser-protection settings also appear to be missing."),
    ("hmcng.com", "Guardian could not identify a clear main heading on the homepage. Some standard browser-protection settings also appear to be missing."),
    ("gabofarms.com", "The homepage appears to be missing some information that helps search engines understand and display it correctly. Some standard browser-protection settings also appear to be missing."),
    ("gabogreenenergysolutions.com", "The homepage appears to be missing some basic search-engine information and page structure. Some standard browser-protection settings also appear to be missing."),
    ("mvpterminallingllc.com", "The homepage appears to be missing the short description search engines may display in search results. Some standard browser-protection settings also appear to be missing."),
    ("fareharbor.com", "The website's search-engine page list redirects somewhere else instead of responding directly. This does not mean the page list is absent. Some browser-protection settings may also need improvement."),
    ("danwebdevelopment.com", "Guardian found missing or incomplete information that helps search engines understand the homepage and locate the website's pages. Some standard browser-protection settings also appear to be missing."),
    ("nenafrika.com", "An earlier check had difficulty reaching the website. A later check succeeded, but the homepage took about 3.6 seconds to respond. This is not enough evidence to call it a continuing performance problem. Some standard browser-protection settings also appear to be missing."),
    ("africancouncilofoptometry.org", "The homepage appears to be missing some information that helps search engines understand and organize it. Some standard browser-protection settings also appear to be missing."),
]
for site, finding in site_findings:
    p = doc.add_paragraph()
    p.paragraph_format.keep_together = True
    r = p.add_run(f"{site}. ")
    r.bold = True
    p.add_run(finding)

doc.add_page_break()
add_heading(doc, "Business owner questionnaire", 1)
add_body(doc, "Ask these questions after the owner agrees to participate. Record the owner's answer as given.")
add_question(doc, 1, "What is the most important job your website performs for your business?", lines=2)
add_question(doc, 2, "Is Guardian's explanation understandable?", ["Yes", "Partly", "No"], lines=1)
add_question(doc, 3, "Do the findings appear relevant to your business?", ["Yes", "Partly", "No", "Unsure"], lines=1)
add_question(doc, 4, "If Guardian sent this warning automatically, would you know what to do next?", ["Yes", "No"], lines=2)
add_question(doc, 5, "Would you ask someone to investigate or fix any of these findings?", ["Yes", "No", "Unsure"], lines=1)
add_question(doc, 6, "Have you previously experienced website slowness, downtime, missing enquiries, poor Google visibility, or security concerns?", ["Yes", "No", "Unsure"], lines=2)
add_question(doc, 7, "Would an earlier warning have saved time, money, enquiries, or customer trust?", lines=2)
add_question(doc, 8, "What information would make Guardian's warning more useful?", lines=2)
add_question(doc, 9, "How useful is this report?", ["1 Not useful", "2", "3", "4", "5 Extremely useful"], lines=0)
add_question(doc, 10, "Would you continue using Guardian to monitor your website?", ["Yes", "No", "Unsure"], lines=1)

doc.add_page_break()
add_heading(doc, "Per business validation record", 1)
add_body(doc, "Complete one copy of this form for each participating business. Keep sensitive contact details outside this document when appropriate.")
fields = [
    "Business identifier",
    "Website",
    "Owner or authorized operator",
    "Permission confirmed and date",
    "Interview date and reviewer",
    "Audit result reference",
]
for field in fields:
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{field}: ")
    r.bold = True
    p.add_run("____________________________________________________________")

add_heading(doc, "Finding review", 2)
for n in (1, 2):
    if n == 2:
        doc.add_page_break()
        add_heading(doc, "Per business validation record continued", 1)
        add_heading(doc, "Finding review continued", 2)
    add_heading(doc, f"Finding {n}", 3)
    for label, options, lines in (
        ("Finding or category", None, 1),
        ("Accurate", ["Yes", "Partly", "No", "Incomplete evidence"], 0),
        ("Understandable", ["Yes", "Partly", "No"], 0),
        ("Business impact credible", ["Yes", "Partly", "No", "Unsure"], 0),
        ("Action taken", ["None", "Planned", "Completed"], 1),
        ("Problem prevented or resolved", ["Yes", "No", "Unknown"], 1),
        ("Outcome evidence", None, 2),
        ("Estimated time cost or opportunity impact", None, 1),
    ):
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        r = p.add_run(f"{label}: ")
        r.bold = True
        if options:
            p.add_run("   ".join(f"[ ] {item}" for item in options))
        if lines:
            add_answer_lines(doc, lines)

doc.add_page_break()
add_heading(doc, "Overall customer assessment", 1)
add_question(doc, 1, "Overall usefulness", ["1", "2", "3", "4", "5"], lines=0)
add_question(doc, 2, "Would continue using Guardian", ["Yes", "No", "Unsure"], lines=1)
add_question(doc, 3, "Most valuable result", lines=2)
add_question(doc, 4, "Most important missing capability", lines=2)
add_question(doc, 5, "Permission to use feedback for internal product validation", ["Yes", "No"], lines=0)
add_question(doc, 6, "Separate permission to quote feedback publicly", ["Yes", "No"], lines=0)

add_heading(doc, "Approved correction record", 1)
for field in (
    "Finding",
    "Proposed correction",
    "Approving person and date",
    "Change completed and date",
    "Follow-up audit result",
    "Owner-confirmed outcome",
):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{field}:")
    r.bold = True
    add_answer_lines(doc, 2 if field in ("Proposed correction", "Owner-confirmed outcome") else 1)

doc.add_page_break()
add_heading(doc, "Customer validation gate review", 1)
add_body(doc, "Complete this section after at least five businesses have finished the owner review.")
gate_rows = [
    ("Businesses with completed owner review", "0", "At least 5"),
    ("Findings confirmed accurate", "0", "Measure and report"),
    ("Findings confirmed partly accurate", "0", "Measure separately"),
    ("False positives", "0", "Investigate every case"),
    ("Owners who took action", "0", "Measure and report"),
    ("Problems confirmed prevented or resolved", "0", "Evidence for every claim"),
]
add_table(doc, ["Metric", "Current", "Review requirement"], gate_rows, [4.1, 0.9, 2.1], font_size=9)

add_heading(doc, "Gate summary", 2)
for label in (
    "Businesses reviewed",
    "Finding accuracy summary",
    "Actions taken",
    "Confirmed problems prevented or resolved",
    "Recurring false positives or unclear explanations",
    "Requested changes within the MVP contract",
    "Product owner gate decision and date",
):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{label}:")
    r.bold = True
    add_answer_lines(doc, 2)

add_heading(doc, "Guardrails", 1)
for item in (
    "Do not describe a technical snapshot as confirmed revenue loss.",
    "Do not describe a basic security finding as a complete cybersecurity assessment.",
    "Do not call a single response-time result a performance trend.",
    "Do not submit live customer forms or alter production settings without explicit approval.",
    "Record unknown when an owner cannot estimate time, cost, or opportunity impact.",
    "Keep permission to participate separate from permission to quote feedback publicly.",
):
    add_bullet(doc, item)

add_heading(doc, "Approved correction message", 1)
add_body(
    doc,
    "You approved the following change: [finding]. The proposed correction is [plain-language correction]. I will make only this specific change and run the same Guardian check again. I will not make other website changes without your permission. Please confirm that I may proceed.",
)

add_heading(doc, "Outcome confirmation questions", 1)
add_body(doc, "After the approved change and follow-up audit, ask:")
for index, item in enumerate((
    "Do you consider the original problem resolved?",
    "Was Guardian helpful in identifying or explaining it?",
    "Did this save time, cost, enquiries, or business risk? Record unknown if it cannot be estimated.",
    "May we record your response for internal product validation?",
    "May we quote your feedback publicly? This permission is optional and separate.",
), start=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_together = True
    p.add_run(f"{index}. {item}")

doc.core_properties.title = "Customer Validation Tracker"
doc.core_properties.subject = "Guardian MVP customer validation workbook"
doc.core_properties.author = "Guardian"
doc.core_properties.keywords = "Guardian, customer validation, MVP, website audit"

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUTPUT)
print(OUTPUT)

"""Generate role-specific Smyrna Tools training packet PDFs.

Outputs are written to ../training/. Design philosophy: minimalist,
typography-driven, professional. Color reserved for real UI elements
(status pills, alert states); everything else is black text on white
with hairline grey rules and a single slate accent.

Content grounded in the actual codebase (navigation, report fields,
asset statuses, maintenance tabs).
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "training"

# ── Palette ────────────────────────────────────────────────────
INK = colors.HexColor("#0B0F14")         # near-black for body
SLATE = colors.HexColor("#1F2937")       # heading / accent
SLATE_MUTED = colors.HexColor("#4B5563")
RULE = colors.HexColor("#E5E7EB")        # hairline rule
RULE_DARK = colors.HexColor("#D1D5DB")
PAGE_BG = colors.white
SOFT = colors.HexColor("#F9FAFB")        # very subtle row tint

# Real UI status colors (used sparingly only inside mockups)
UI_GREEN = colors.HexColor("#16A34A")
UI_BLUE = colors.HexColor("#1E40AF")
UI_TEAL = colors.HexColor("#0891B2")
UI_AMBER = colors.HexColor("#B45309")
UI_RED = colors.HexColor("#B91C1C")
UI_GRAY = colors.HexColor("#475569")

styles = getSampleStyleSheet()


# ── Type system ────────────────────────────────────────────────
def style(name, **overrides):
    base = ParagraphStyle(
        name,
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        textColor=INK,
        leading=14,
        spaceAfter=4,
        spaceBefore=0,
    )
    for k, v in overrides.items():
        setattr(base, k, v)
    return base


COVER_PRODUCT = style("CoverProduct", fontName="Helvetica", fontSize=9.5,
                      textColor=SLATE_MUTED, alignment=TA_CENTER, leading=12)
COVER_TITLE = style("CoverTitle", fontName="Helvetica-Bold", fontSize=42,
                    textColor=INK, alignment=TA_CENTER, leading=46)
COVER_SUB = style("CoverSub", fontName="Helvetica", fontSize=11,
                  textColor=SLATE_MUTED, alignment=TA_CENTER, leading=15)
COVER_META = style("CoverMeta", fontName="Helvetica", fontSize=8.5,
                   textColor=SLATE_MUTED, alignment=TA_CENTER, leading=12)

H1 = style("H1", fontName="Helvetica-Bold", fontSize=20, textColor=INK,
           leading=24, spaceBefore=0, spaceAfter=4)
H2 = style("H2", fontName="Helvetica-Bold", fontSize=12.5, textColor=INK,
           leading=17, spaceBefore=14, spaceAfter=4)
EYEBROW = style("Eyebrow", fontName="Helvetica-Bold", fontSize=8.5,
                textColor=SLATE_MUTED, leading=11, spaceAfter=2)
LEAD = style("Lead", fontSize=11, textColor=SLATE_MUTED, leading=15.5, spaceAfter=10)
BODY = style("Body", fontSize=10, textColor=INK, leading=14.5, spaceAfter=4)
BODY_TIGHT = style("BodyTight", fontSize=10, textColor=INK, leading=13.5, spaceAfter=2)
SMALL = style("Small", fontSize=8.5, textColor=SLATE_MUTED, leading=11)
SMALL_INK = style("SmallInk", fontSize=8.5, textColor=INK, leading=11)
STEP_NUM = style("StepNum", fontName="Helvetica-Bold", fontSize=10,
                 textColor=SLATE_MUTED, leading=14, alignment=TA_LEFT)
STEP_TITLE = style("StepTitle", fontName="Helvetica-Bold", fontSize=10,
                   textColor=INK, leading=14)
STEP_BODY = style("StepBody", fontSize=10, textColor=SLATE_MUTED, leading=14)

TABLE_HEAD = style("TableHead", fontName="Helvetica-Bold", fontSize=8.5,
                   textColor=SLATE_MUTED, leading=11)
TABLE_CELL = style("TableCell", fontSize=10, textColor=INK, leading=13.5)
TABLE_CELL_MUTED = style("TableCellMuted", fontSize=10, textColor=SLATE_MUTED, leading=13.5)

NOTE_LABEL = style("NoteLabel", fontName="Helvetica-Bold", fontSize=8.5,
                   textColor=SLATE, leading=11)

FOOTER = style("Footer", fontSize=7.5, textColor=SLATE_MUTED,
               alignment=TA_LEFT, leading=10)


# ── Page chrome ────────────────────────────────────────────────


def cover_page(canvas, doc):
    canvas.saveState()
    # very subtle top band
    canvas.setFillColor(SOFT)
    canvas.rect(0, LETTER[1] - 0.4 * inch, LETTER[0], 0.4 * inch, fill=1, stroke=0)
    canvas.setStrokeColor(RULE_DARK)
    canvas.setLineWidth(0.4)
    canvas.line(0.85 * inch, LETTER[1] - 0.4 * inch, LETTER[0] - 0.85 * inch, LETTER[1] - 0.4 * inch)

    canvas.setFillColor(SLATE_MUTED)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(0.85 * inch, LETTER[1] - 0.27 * inch, "SMYRNA TOOLS")
    canvas.drawRightString(LETTER[0] - 0.85 * inch, LETTER[1] - 0.27 * inch, "Training")

    # bottom hairline
    canvas.line(0.85 * inch, 0.55 * inch, LETTER[0] - 0.85 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.85 * inch, 0.4 * inch, "Confidential - Internal use only")
    canvas.drawRightString(LETTER[0] - 0.85 * inch, 0.4 * inch, "v2026.20.8")
    canvas.restoreState()


def page_chrome_factory(role_label):
    def _on_page(canvas, doc):
        canvas.saveState()
        # top: thin slate eyebrow + thin rule
        canvas.setFillColor(SLATE_MUTED)
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.drawString(0.85 * inch, LETTER[1] - 0.5 * inch, "SMYRNA TOOLS")
        canvas.setFont("Helvetica", 8.5)
        canvas.drawString(2.0 * inch, LETTER[1] - 0.5 * inch, role_label)
        canvas.setFont("Helvetica", 8.5)
        canvas.drawRightString(LETTER[0] - 0.85 * inch, LETTER[1] - 0.5 * inch, f"{doc.page:02d}")

        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.4)
        canvas.line(0.85 * inch, LETTER[1] - 0.6 * inch, LETTER[0] - 0.85 * inch, LETTER[1] - 0.6 * inch)

        canvas.setStrokeColor(RULE)
        canvas.line(0.85 * inch, 0.5 * inch, LETTER[0] - 0.85 * inch, 0.5 * inch)
        canvas.setFillColor(SLATE_MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(0.85 * inch, 0.36 * inch, f"{role_label} Training Packet")
        canvas.drawRightString(LETTER[0] - 0.85 * inch, 0.36 * inch, "v2026.20.8")
        canvas.restoreState()

    return _on_page


# ── Primitives ─────────────────────────────────────────────────


CONTENT_WIDTH = 6.8  # inches


def hr():
    t = Table([[""]], colWidths=[CONTENT_WIDTH * inch], rowHeights=[1])
    t.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def section(title, eyebrow=None):
    items = [Spacer(1, 4)]
    if eyebrow:
        items.append(Paragraph(eyebrow.upper(), EYEBROW))
    items.append(Paragraph(title, H1))
    items.append(Spacer(1, 6))
    items.append(hr())
    items.append(Spacer(1, 10))
    return items


def subsection(title):
    return [Paragraph(title, H2)]


def lead(text):
    return [Paragraph(text, LEAD)]


def body(text):
    return [Paragraph(text, BODY)]


def small(text):
    return [Paragraph(text, SMALL)]


def step(num, title, *body_lines):
    """A clean numbered step: '01 — Title' on left, body indented under."""
    head = Paragraph(
        f"<font color='#9CA3AF' size='10'><b>{num:02d}</b></font>  "
        f"<font color='#0B0F14'><b>{title}</b></font>",
        BODY,
    )
    rows = [[head]]
    for line in body_lines:
        rows.append([Paragraph(line, STEP_BODY)])
    t = Table(rows, colWidths=[CONTENT_WIDTH * inch])
    t.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 1), (0, -1), 24),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
            ]
        )
    )
    return [t]


def note(text, label="Note"):
    """Subtle note with a single thin left rule, no fill."""
    para = Paragraph(
        f"<font color='#1F2937'><b>{label}.</b></font>  "
        f"<font color='#4B5563'>{text}</font>",
        BODY,
    )
    t = Table([[para]], colWidths=[CONTENT_WIDTH * inch])
    t.setStyle(
        TableStyle(
            [
                ("LINEBEFORE", (0, 0), (0, 0), 1.5, SLATE),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return [Spacer(1, 4), t, Spacer(1, 4)]


def warn(text):
    return note(text, label="Important")


def tip(text):
    return note(text, label="Tip")


def table(rows, col_widths, header=True):
    """Borderless table with hairline horizontal rules. No fills."""
    para_rows = []
    for r_idx, row in enumerate(rows):
        row_paras = []
        for cell in row:
            if r_idx == 0 and header:
                row_paras.append(Paragraph(str(cell).upper(), TABLE_HEAD))
            else:
                row_paras.append(Paragraph(str(cell), TABLE_CELL) if isinstance(cell, str) else cell)
        para_rows.append(row_paras)

    t = Table(para_rows, colWidths=col_widths, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
    ]
    if header:
        cmds += [
            ("LINEABOVE", (0, 1), (-1, 1), 0.6, INK),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, INK),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 0), (-1, 0), 0),
        ]
    t.setStyle(TableStyle(cmds))
    return t


# ── Mockup primitives (minimalist wireframes) ──────────────────


def mockup(title, *content_rows):
    """A minimalist 'screen mockup' rendered as a bordered box.

    title appears as a small eyebrow on top; content is plain paragraphs.
    """
    title_row = Table(
        [[Paragraph(title.upper(), EYEBROW)]],
        colWidths=[CONTENT_WIDTH * inch],
    )
    title_row.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEABOVE", (0, 0), (-1, -1), 0.4, RULE_DARK),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
                ("LINEBEFORE", (0, 0), (0, -1), 0.4, RULE_DARK),
                ("LINEAFTER", (-1, 0), (-1, -1), 0.4, RULE_DARK),
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
            ]
        )
    )

    body_rows = [[r] for r in content_rows]
    body_table = Table(body_rows, colWidths=[CONTENT_WIDTH * inch])
    body_table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBEFORE", (0, 0), (0, -1), 0.4, RULE_DARK),
                ("LINEAFTER", (-1, 0), (-1, -1), 0.4, RULE_DARK),
                ("LINEBELOW", (0, -1), (-1, -1), 0.4, RULE_DARK),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return [Spacer(1, 8), title_row, body_table, Spacer(1, 12)]


def pill(label, color):
    """A real UI status pill - shows actual UI color."""
    para = Paragraph(
        f"<font color='white'><b>{label}</b></font>",
        style("PillText", fontSize=8, alignment=TA_CENTER, leading=10),
    )
    t = Table([[para]], colWidths=[0.85 * inch], rowHeights=[0.2 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return t


def pill_row(pills):
    t = Table([pills], colWidths=[0.95 * inch] * len(pills), rowHeights=[0.26 * inch])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def btn(label, primary=False):
    """A minimalist button. Primary = filled slate; secondary = outlined."""
    if primary:
        text_color = "white"
        bg = SLATE
        border = SLATE
    else:
        text_color = "#0B0F14"
        bg = colors.white
        border = RULE_DARK
    para = Paragraph(
        f"<font color='{text_color}'><b>{label}</b></font>",
        style("BtnText", fontSize=9, alignment=TA_CENTER, leading=11),
    )
    t = Table([[para]], colWidths=[1.0 * inch], rowHeights=[0.26 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def btn_row(buttons):
    cols = len(buttons)
    t = Table([buttons], colWidths=[1.1 * inch] * cols, rowHeights=[0.3 * inch])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


# ── Mockup builders (shared) ───────────────────────────────────


def m_login():
    field = lambda label, val: Table(
        [
            [Paragraph(label.upper(), EYEBROW)],
            [Paragraph(val, BODY_TIGHT)],
        ],
        colWidths=[CONTENT_WIDTH * inch - 28],
        style=TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                ("LINEBELOW", (0, 1), (-1, 1), 0.6, INK),
            ]
        ),
    )
    return mockup(
        "Sign-in screen",
        Paragraph("<b>Smyrna Ready Mix</b>", BODY),
        Paragraph("Welcome back.", SMALL),
        Spacer(1, 10),
        field("Email", "you@smyrnareadymix.com"),
        Spacer(1, 10),
        field("Password", "***********"),
        Spacer(1, 14),
        Table(
            [[btn("Sign in", primary=True), Paragraph("<i>Forgot password?</i>", SMALL)]],
            colWidths=[1.1 * inch, 5.0 * inch],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (1, 0), (1, 0), 0),
                    ("LEFTPADDING", (1, 0), (1, 0), 16),
                ]
            ),
        ),
    )


def m_top_nav():
    nav_items = [
        ("SRM", True),
        ("Dashboard", False),
        ("Tools", False),
        ("Assets", False),
        ("People", False),
        ("Reporting", False),
        ("Admin", False),
        ("Region", False),
        ("Bell", False),
        ("Online", False),
        ("You", False),
    ]
    cells = []
    for label, _ in nav_items:
        para = Paragraph(
            f"<font color='#4B5563' size='9'>{label}</font>",
            style("NavCell", fontSize=9, alignment=TA_CENTER, leading=11),
        )
        cells.append(para)
    nav = Table(
        [cells],
        colWidths=[0.55, 0.95, 0.55, 0.7, 0.7, 0.85, 0.55, 0.65, 0.4, 0.5, 0.4],
        rowHeights=[0.32 * inch],
    )
    nav = Table(
        [cells],
        colWidths=[w * inch for w in [0.55, 0.95, 0.55, 0.7, 0.7, 0.85, 0.55, 0.65, 0.4, 0.5, 0.4]],
        rowHeights=[0.32 * inch],
    )
    nav.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE_DARK),
                ("LINEAFTER", (0, 0), (-2, -1), 0.4, RULE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return mockup(
        "Top navigation",
        nav,
        Spacer(1, 6),
        Paragraph(
            "Left side: <b>logo</b>, then your menu groups. "
            "Right side: <b>region picker</b>, notifications bell, online users, your initials.",
            BODY,
        ),
        Paragraph(
            "Menus appear only if you have permission. If a group is missing, "
            "you don't have access - that's by design.",
            SMALL,
        ),
    )


def m_status_pills(label, include_extras=False):
    pills = [
        pill("Active", UI_GREEN),
        pill("Spare", UI_TEAL),
        pill("In Shop", UI_BLUE),
        pill("Retired", UI_GRAY),
    ]
    if include_extras:
        pills.extend([pill("Stationary", colors.HexColor("#0F766E")), pill("Sold", colors.HexColor("#7C2D12"))])

    return mockup(
        f"{label} statuses",
        pill_row(pills),
        Spacer(1, 6),
        Paragraph(
            "These are the exact words and colors you'll see in the dropdown. "
            "<b>In Shop</b> is two words.",
            BODY,
        ),
    )


def m_maintenance_pills():
    pills = [
        pill("OK", UI_GREEN),
        pill("Due Soon", UI_AMBER),
        pill("Overdue", UI_RED),
        pill("Never", UI_GRAY),
    ]
    return mockup(
        "Maintenance status",
        pill_row(pills),
        Spacer(1, 6),
        Paragraph(
            "Filter the Maintenance Log by these. Overdue is today's work. "
            "Due Soon is tomorrow's plan.",
            BODY,
        ),
    )


def m_dashboard():
    grid = Table(
        [
            [
                Paragraph("<b>Side nav</b>", EYEBROW),
                Paragraph("<b>Main</b>", EYEBROW),
                Paragraph("<b>Right rail</b>", EYEBROW),
            ],
            [
                Paragraph("Alerts<br/>Schedule<br/>Fleet<br/>People", BODY_TIGHT),
                Paragraph("KPI strip<br/>Fleet table<br/>People table<br/>Alerts list", BODY_TIGHT),
                Paragraph("At-a-glance<br/>label / value snapshot", BODY_TIGHT),
            ],
        ],
        colWidths=[1.6 * inch, 2.7 * inch, 2.3 * inch],
    )
    grid.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ("TOPPADDING", (0, 1), (-1, 1), 6),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE_DARK),
            ]
        )
    )
    return mockup(
        "Dashboard",
        grid,
        Spacer(1, 6),
        Paragraph(
            "Small red numbers next to Alerts and People are unread counts. "
            "Tap a row to jump to that section.",
            SMALL,
        ),
    )


def m_pm_report():
    return mockup(
        "Plant Manager weekly report",
        Paragraph(
            "Left column: <b>Operators sent to other plants</b> - click "
            "<i>Add operator</i>, pick the destination plant, pick the operator, type hours (0-80).",
            BODY,
        ),
        Spacer(1, 4),
        Paragraph(
            "Right column: <b>Yards per man-hour</b> with grade pill "
            "(Excellent / Good / Average / Poor). Auto-calculated.",
            BODY,
        ),
        Spacer(1, 4),
        Paragraph(
            "Below: <b>Weekly trends</b> showing the last several weeks of yardage, hours, YPH.",
            BODY,
        ),
        Spacer(1, 10),
        btn_row([btn("Save draft"), btn("Submit", primary=True)]),
        Spacer(1, 6),
        Paragraph(
            "Yardage and total hours are auto-pulled from the Plant Production report. "
            "You don't type those.",
            SMALL,
        ),
    )


def m_dm_report():
    rows = [
        [Paragraph("<b>" + day + "</b>", BODY_TIGHT), Paragraph(f"<i>Notes for {day.lower()}…</i>", SMALL)]
        for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    ]
    t = Table(rows, colWidths=[1.0 * inch, 5.6 * inch])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
            ]
        )
    )
    return mockup(
        "District Manager weekly report",
        t,
        Spacer(1, 10),
        btn_row([btn("Save draft"), btn("Submit", primary=True)]),
        Spacer(1, 6),
        Paragraph("Each day is a free-text box. 3-5 sentences each is right.", SMALL),
    )


def m_gm_report():
    metric_rows = [
        ["Metric", "Last week", "This week", "Variance"],
        ["# of Operators", "(auto)", "____", "(auto)"],
        ["# of Runnable Trucks", "(auto)", "____", "(auto)"],
        ["Down Trucks", "(auto)", "____", "(auto)"],
        ["Operators Starting", "(auto)", "____", "(auto)"],
        ["Operators Leaving", "(auto)", "____", "(auto)"],
        ["New Operators Training", "(auto)", "____", "(auto)"],
        ["Total Yardage", "(auto)", "____", "(auto)"],
        ["Total Hours", "(auto)", "____", "(auto)"],
    ]
    para_rows = []
    for r_idx, row in enumerate(metric_rows):
        cells = []
        for c_idx, cell in enumerate(row):
            if r_idx == 0:
                cells.append(Paragraph(cell.upper(), TABLE_HEAD))
            elif c_idx == 0:
                cells.append(Paragraph(cell, BODY_TIGHT))
            else:
                cells.append(Paragraph(cell, TABLE_CELL_MUTED))
        para_rows.append(cells)
    t = Table(para_rows, colWidths=[2.2 * inch, 1.45 * inch, 1.45 * inch, 1.45 * inch])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
                ("LINEABOVE", (0, 1), (-1, 1), 0.6, INK),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, INK),
            ]
        )
    )
    return mockup(
        "General Manager weekly report - per plant",
        Paragraph("Each plant gets its own block with this table:", BODY),
        Spacer(1, 6),
        t,
        Spacer(1, 12),
        btn_row([btn("Generate AI"), btn("Save draft"), btn("Submit", primary=True)]),
        Spacer(1, 6),
        Paragraph(
            "All eight rows per plant are required. Last week and variance are auto-filled.",
            SMALL,
        ),
    )


def m_maintenance_log():
    pills = pill_row(
        [
            pill("OK", UI_GREEN),
            pill("Due Soon", UI_AMBER),
            pill("Overdue", UI_RED),
            pill("Never", UI_GRAY),
        ]
    )
    return mockup(
        "Maintenance log",
        Paragraph("<b>Tabs:</b>  Maintenance Log    |    Manage Forms", BODY),
        Spacer(1, 6),
        Paragraph("<b>Status filter:</b>", BODY_TIGHT),
        Spacer(1, 4),
        pills,
        Spacer(1, 8),
        Paragraph("<b>Other filters:</b>  Search    |    Plant dropdown    |    Category dropdown", BODY_TIGHT),
        Spacer(1, 8),
        Paragraph(
            "Below: a table of every asset with last-service date, service type, and status. "
            "Click any row to open the asset detail.",
            BODY,
        ),
        Spacer(1, 6),
        Paragraph(
            "Right rail: Due Items, Pending Reviews, My Submissions, My Forms.",
            SMALL,
        ),
    )


# ── Page assemblies ────────────────────────────────────────────


def build_cover(role_label, role_tagline):
    return [
        Spacer(1, 2.4 * inch),
        Paragraph("SMYRNA TOOLS - TRAINING PACKET", COVER_PRODUCT),
        Spacer(1, 18),
        Paragraph(role_label, COVER_TITLE),
        Spacer(1, 14),
        Paragraph(role_tagline, COVER_SUB),
        Spacer(1, 2.0 * inch),
        Paragraph(
            "Read once cover to cover. Keep open as a reference.",
            COVER_META,
        ),
        PageBreak(),
    ]


def build_at_a_glance(role_label, daily, weekly, screens):
    items = section("At a glance", eyebrow="Start here")
    items.extend(
        lead(
            "If you only remember one page, make it this one."
        )
    )

    items.extend(subsection("Every day"))
    rows = [["", "Action"]]
    for d in daily:
        rows.append([f"{daily.index(d) + 1:02d}", f"<b>{d['title']}.</b>  <font color='#4B5563'>{d['body']}</font>"])
    items.append(table(rows, col_widths=[0.5 * inch, 6.3 * inch], header=False))

    items.extend(subsection("Every week"))
    rows = [["", "Action"]]
    for d in weekly:
        rows.append([f"{weekly.index(d) + 1:02d}", f"<b>{d['title']}.</b>  <font color='#4B5563'>{d['body']}</font>"])
    items.append(table(rows, col_widths=[0.5 * inch, 6.3 * inch], header=False))

    items.extend(subsection("Where to find things"))
    rows = [["Need", "Screen", "Path"]]
    for s in screens:
        rows.append([s["need"], s["screen"], s["path"]])
    items.append(table(rows, col_widths=[1.9 * inch, 2.2 * inch, 2.7 * inch]))

    items.append(PageBreak())
    return items


def build_welcome(role_label, summary, responsibilities):
    items = section(f"Welcome, {role_label}", eyebrow="01")
    for p in summary:
        items.extend(body(p))

    items.extend(subsection("Your responsibilities"))
    rows = [["#", "Responsibility"]]
    for idx, resp in enumerate(responsibilities, 1):
        rows.append([f"{idx:02d}", resp])
    items.append(table(rows, col_widths=[0.5 * inch, 6.3 * inch], header=False))
    items.append(PageBreak())
    return items


def build_getting_started():
    items = section("Getting started", eyebrow="02")
    items.extend(lead("Sign in, find your way around, pick the right region."))

    items.extend(subsection("Sign in"))
    items.extend(step(1, "Go to smyrnatools.com",
                      "Chrome, Edge, or Safari. On a phone, type it into the address bar."))
    items.extend(step(2, "Enter your work email",
                      "The email your administrator provided."))
    items.extend(step(3, "Enter your password",
                      "First time only - you may be prompted to set a new one. 12+ characters with letters, numbers, a symbol."))
    items.extend(step(4, "Click Sign in",
                      "You'll land on the Dashboard."))
    items.extend(m_login())
    items.extend(
        tip(
            "If the reset email doesn't arrive within five minutes, your account may be Locked or Terminated. "
            "Ask your administrator."
        )
    )

    items.extend(subsection("Top navigation"))
    items.extend(
        body(
            "Everything starts from the dark bar at the top. Menus you can't use are hidden, "
            "so don't worry if your bar looks shorter than someone else's."
        )
    )
    items.extend(m_top_nav())

    items.extend(subsection("Region picker"))
    items.extend(
        body(
            "The picker on the top-right decides which plants and assets you see. "
            "If you cover multiple regions, switch between them here. Your last choice is remembered."
        )
    )
    items.extend(
        warn(
            "If a screen looks empty, the region is the first thing to check."
        )
    )
    items.append(PageBreak())
    return items


def build_dashboard(intro):
    items = section("Dashboard", eyebrow="03")
    items.extend(lead(intro))
    items.extend(m_dashboard())

    rows = [
        ["Section", "What it tells you", "When to act"],
        ["Alerts", "Anything that needs a decision - shop, quality, missing reports.", "Anything red: same day."],
        ["Schedule", "Today's plan. Orders booked, what each plant is running.", "Before the first dispatch call."],
        ["Fleet", "Active / Spare / In Shop counts per asset type.", "If 'In Shop' is high, borrow trucks."],
        ["People", "Who's clocked in. Light duty. Starting this week.", "Before assigning today's work."],
    ]
    items.append(table(rows, col_widths=[0.95 * inch, 3.55 * inch, 2.3 * inch]))
    items.append(PageBreak())
    return items


def build_troubleshooting():
    items = section("Troubleshooting", eyebrow="When things look wrong")
    rows = [
        ["Symptom", "Cause", "Fix"],
        ["Grey 'Locked' overlay", "Your role is guest-only.", "Ask your administrator to upgrade you."],
        ["Grey 'Terminated' overlay", "HR marked your account terminated.", "Call HR or your administrator."],
        ["Fewer plants than expected", "Wrong region selected.", "Top-right: pick the correct region."],
        ["Submit does nothing", "A required field is missing.", "Scroll up. Red fields are missing."],
        ["'Forbidden: insufficient privileges'", "Your role weight is below the threshold.", "Have a DM or GM perform it."],
        ["Numbers don't refresh", "Cached page.", "Cmd-Shift-R (Mac) or Ctrl-Shift-R (Windows)."],
        ["Lost a form", "Drafts autosave - it's still there.", "Reopen the form. Your draft loads."],
        ["Can't find an operator or asset", "A filter is hiding it.", "Clear filters with the X. Search again."],
    ]
    items.append(table(rows, col_widths=[1.9 * inch, 2.3 * inch, 2.6 * inch]))
    items.append(PageBreak())
    return items


def build_help():
    items = section("Getting unstuck", eyebrow="Who to ask")

    items.extend(subsection("Self-serve first"))
    items.extend(step(1, "Use the Dashboard chat",
                      "Type plain English. It answers questions about your fleet."))
    items.extend(step(2, "Check Notifications",
                      "Bell icon shows recent system events with deep links."))
    items.extend(step(3, "Hover over icons",
                      "Every icon-only button has a label on hover."))

    items.extend(subsection("Ask your administrator"))
    for line in [
        "You can't see a plant, region, or report you should have access to.",
        "Your role changed and the new screens aren't appearing.",
        "Data is clearly wrong - negative counts, missing days, duplicates.",
        "A red error appears that isn't in the troubleshooting table.",
    ]:
        items.append(Paragraph(f"<font color='#9CA3AF'>—</font>  {line}", BODY))

    items.extend(subsection("Reporting a bug"))
    items.extend(step(1, "Screenshot the screen",
                      "Capture exactly what you see, including any error."))
    items.extend(step(2, "Note the time and what you clicked",
                      "The engineering team can find the matching log entry."))
    items.extend(step(3, "Send to your administrator",
                      "They route to engineering. Don't post screenshots publicly."))

    items.append(PageBreak())
    return items


def build_acknowledgement(role_label):
    items = section("Acknowledgement", eyebrow="Final page")
    items.extend(
        lead(
            f"After completing this packet, sign below to confirm you've read and understood "
            f"your responsibilities as a {role_label}."
        )
    )

    rows = [
        ["Full name", ""],
        ["Employee ID", ""],
        ["Plant / region", ""],
        ["Date completed", ""],
        ["Your signature", ""],
        ["Trainer name", ""],
        ["Trainer signature", ""],
    ]
    para_rows = []
    for r in rows:
        para_rows.append([Paragraph(r[0], TABLE_CELL_MUTED), Paragraph(r[1], TABLE_CELL)])
    t = Table(para_rows, colWidths=[1.8 * inch, 5.0 * inch])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
                ("TOPPADDING", (0, 0), (-1, -1), 18),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    items.append(t)
    return items


# ── Role-specific bodies ───────────────────────────────────────


def body_plant_manager():
    items = section("Weekly report", eyebrow="04")
    items.extend(lead("Saturday. Five minutes if your statuses are current."))
    items.extend(m_pm_report())

    items.extend(subsection("Field by field"))
    rows = [
        ["Field", "Source", "Your job"],
        ["Yardage", "Auto-pulled from Plant Production.", "Spot-check. Don't retype."],
        ["Total Hours", "Auto-pulled from time records.", "Spot-check. Flag your DM if off."],
        ["Operators sent", "You enter one row per helper.",
         "Click Add operator. Destination plant. Operator. Hours."],
        ["YPH", "App calculates yardage / hours.",
         "Read the grade pill. No action needed."],
    ]
    items.append(table(rows, col_widths=[1.4 * inch, 2.6 * inch, 2.8 * inch]))

    items.extend(subsection("Steps"))
    items.extend(step(1, "Open Reporting → Reports",
                      "Reports hub opens on the My Reports tab."))
    items.extend(step(2, "Find the Plant Manager card for this week",
                      "Yellow dot = due. Red dot = overdue."))
    items.extend(step(3, "Click the card to open the form",
                      "Operators-sent table on left. YPH metric on right."))
    items.extend(step(4, "Add each operator you sent out",
                      "Add operator → destination plant → operator → hours."))
    items.extend(step(5, "Click Submit",
                      "Card turns green. Your DM is notified."))
    items.extend(
        note(
            "Save draft if you need to come back. Drafts auto-save every few seconds.",
            label="Drafts",
        )
    )
    items.append(PageBreak())

    items.extend(section("Fleet", eyebrow="05"))
    items.extend(lead("Update status the same shift it changes. Comments survive forever."))
    items.extend(m_status_pills("Mixer"))

    items.extend(subsection("Change a status"))
    items.extend(step(1, "Open Assets → Mixers (or Tractors / Trailers / Heavy Equipment / Pickup Trucks)",
                      "List shows every asset at your plant for the current region."))
    items.extend(step(2, "Click the asset row",
                      "Detail panel opens."))
    items.extend(step(3, "Open the Status dropdown",
                      "Pick exactly: Active, Spare, In Shop, or Retired."))
    items.extend(step(4, "Write a quick comment",
                      "Always say why. 'Rear seal leak - shop 5/13' beats 'shop'."))
    items.extend(step(5, "Save",
                      "Logged in asset history with your name and timestamp."))
    items.extend(
        tip(
            "Attach a phone photo to the comment if you have one. "
            "The shop manager sees it when they open the asset."
        )
    )
    items.append(PageBreak())

    items.extend(section("Lost loads and quality", eyebrow="06"))

    items.extend(subsection("Lost load - spilled, rejected, returned"))
    items.extend(
        body(
            "Use this when concrete didn't get delivered. Open it before the truck reaches the yard."
        )
    )
    items.extend(step(1, "Reporting → Reports → Quick Rail → Lost Load Report"))
    items.extend(step(2, "Pick the truck and order",
                      "Both are on the original ticket."))
    items.extend(step(3, "Choose a root cause",
                      "Spilled, customer rejected, ticket error. Be honest."))
    items.extend(step(4, "Narrative and photos",
                      "Two phone photos beats one paragraph."))
    items.extend(step(5, "Submit",
                      "QC Manager and your DM are notified instantly."))
    items.extend(warn("When in doubt, file it. Deleting an extra is easy. Adding a week later is hard."))

    items.extend(subsection("Quality issue - delivered but defective"))
    items.extend(
        body(
            "Different from lost load. Use this when concrete <i>was</i> delivered but had a problem - "
            "slump, mix, late, customer complaint."
        )
    )
    items.extend(step(1, "Reporting → Reports → Quality",
                      "Or use the Quality Issues side rail."))
    items.extend(step(2, "Click New quality issue",
                      "A modal opens."))
    items.extend(step(3, "Fill order, ticket, mix, category, severity",
                      "Severity controls whether it pages QC now or shows in their daily roll-up."))
    items.extend(step(4, "Describe, attach photos, submit",
                      "QC owns the resolution. You'll see updates on the thread."))

    items.append(PageBreak())
    return items


def body_district_manager():
    items = section("Your week", eyebrow="04")
    items.extend(lead("Two non-negotiables: submit your report Sunday. Approve every PM report by Monday."))

    rows = [
        ["Day", "What you do", "Where"],
        ["Mon", "Read weekend output. Set priorities.", "Dashboard - Schedule + Fleet"],
        ["Tue", "Plant visits. Use the app on mobile.", "Mobile - any view"],
        ["Wed", "Mid-week pulse. Yardage and quality trends.", "Dashboard, Quality tab"],
        ["Thu", "Address shop and quality. Coordinate sharing.", "Maintenance, Review"],
        ["Fri", "Confirm PM reports are on track.", "Reports - My Reports"],
        ["Sat", "Spot-check that PMs submitted.", "Reports - Review"],
        ["Sun", "Write DM report. Review all PMs.", "Reports - DM card + Review"],
    ]
    items.append(table(rows, col_widths=[0.6 * inch, 3.6 * inch, 2.6 * inch]))
    items.append(PageBreak())

    items.extend(section("District Manager report", eyebrow="05"))
    items.extend(lead("Six free-text boxes, one per weekday. 3-5 sentences each. Brevity is a feature."))
    items.extend(m_dm_report())

    items.extend(subsection("Anatomy of a good daily recap"))
    rows = [
        ["Element", "Example"],
        ["What ran", "District poured 2,140 yards across 14 loads."],
        ["What broke", "Plant 41 mixer 308 down with a hydraulic leak - shop."],
        ["What you did", "Borrowed Plant 38 mixer 412 to cover three afternoon pours."],
        ["What's next", "Following up with shop on 308 return date Monday."],
    ]
    items.append(table(rows, col_widths=[1.5 * inch, 5.3 * inch]))
    items.extend(
        tip(
            "Block 30 minutes every Sunday. Same time every week. "
            "Momentum beats trying to remember Wednesday on Sunday night."
        )
    )
    items.append(PageBreak())

    items.extend(section("Reviewing PM reports", eyebrow="06"))
    items.extend(
        lead(
            "Approve without reading and you propagate bad data upward. "
            "Treat each review as a quick quality check."
        )
    )

    items.extend(step(1, "Open Reporting → Reports → Review",
                      "Each report shows Awaiting / Approved / Returned."))
    items.extend(step(2, "Click each report",
                      "Form opens read-only with side-by-side last week."))
    items.extend(step(3, "Sanity-check yardage and hours",
                      "Big swings (>20%) without a note are the usual issue."))
    items.extend(step(4, "Approve or Return-to-draft",
                      "Include a one-sentence reason if you return."))
    items.extend(
        warn(
            "Never edit a PM's submitted report yourself. Return it. "
            "Editing their numbers erodes their ownership of them."
        )
    )

    items.extend(subsection("Watch for"))
    for line in [
        "Yardage swings more than 20% week-over-week with no note.",
        "Hours and yardage that don't track together.",
        "Operator-sharing rows missing from the receiving plant's report.",
        "Empty or copy-pasted comments week after week.",
    ]:
        items.append(Paragraph(f"<font color='#9CA3AF'>—</font>  {line}", BODY))
    items.append(PageBreak())

    items.extend(section("Assigning users to plants", eyebrow="07"))
    items.extend(lead("You can assign anyone in your district to one or more plants."))

    items.extend(step(1, "Open People → Managers",
                      "Every manager in your district."))
    items.extend(step(2, "Click the manager",
                      "Detail panel opens with plant assignments at the top."))
    items.extend(step(3, "Check or uncheck plants",
                      "Only plants in your district appear. Takes effect on their next sign-in."))
    items.extend(step(4, "Save",
                      "Green toast confirms."))
    items.extend(
        note(
            "Only roles your administrator has marked <i>eligible</i> appear in the picker. "
            "If a role is missing, ask the administrator - don't substitute a different role.",
            label="Eligibility",
        )
    )
    items.append(PageBreak())
    return items


def body_shop_manager():
    items = section("Your day", eyebrow="04")
    items.extend(lead("The Maintenance Log is your Dashboard. Open it first."))
    items.extend(m_maintenance_log())

    items.extend(subsection("Open the shop"))
    items.extend(step(1, "Reporting → Maintenance",
                      "Lands on Maintenance Log tab."))
    items.extend(step(2, "Filter to Overdue",
                      "These don't move to tomorrow."))
    items.extend(step(3, "Filter to Due Soon",
                      "Tomorrow's work. Plan the bays now."))
    items.extend(step(4, "Check the right rail",
                      "Pending Reviews are technician submissions bottlenecking the floor."))
    items.extend(step(5, "Walk the floor with the list",
                      "Pull up the log on your phone in the bay."))
    items.append(PageBreak())

    items.extend(section("Asset arrives", eyebrow="05"))
    items.extend(
        lead(
            "Mark it In Shop the moment it rolls in - not when the tech picks it up. "
            "PM spare-ratio math depends on you."
        )
    )
    items.extend(m_status_pills("Mixer"))

    items.extend(step(1, "Open the right asset list",
                      "Mixers, Tractors, Trailers, Heavy Equipment, or Pickup Trucks."))
    items.extend(step(2, "Click the row",
                      "Detail panel opens."))
    items.extend(step(3, "Pick In Shop",
                      "Two words. Matches the dropdown."))
    items.extend(step(4, "Comment with symptom and tech",
                      "'Rear seal leak - Garcia working it' is enough."))
    items.extend(step(5, "Save",
                      "Plant's spare count updates instantly."))
    items.append(PageBreak())

    items.extend(section("Forms", eyebrow="06"))

    items.extend(subsection("Author a new template"))
    items.extend(step(1, "Maintenance → Manage Forms",
                      "Second tab on the Maintenance screen."))
    items.extend(step(2, "Click Create form",
                      "Blank template opens."))
    items.extend(step(3, "Name and frequency",
                      "Name it clearly ('Quarterly brake inspection'). Pick frequency."))
    items.extend(step(4, "Add fields",
                      "Text, number, dropdown, checkbox, photo, signature. Keep it lean."))
    items.extend(step(5, "Save",
                      "Now assignable to assets."))

    items.extend(subsection("Review a submission"))
    items.extend(step(1, "Open Maintenance Log",
                      "Right rail shows Pending Reviews."))
    items.extend(step(2, "Click a submission",
                      "Completed form opens with all fields and photos."))
    items.extend(step(3, "Verify required fields and photos",
                      "Cross-check hours / mileage against history."))
    items.extend(step(4, "Approve or Return-to-draft",
                      "If returning, name the specific field that needs work."))
    items.extend(
        tip(
            "If a technician routinely sends incomplete forms, walk them through one in person. "
            "Returning via the system rarely sticks on its own."
        )
    )
    items.append(PageBreak())

    items.extend(section("Long-term shop", eyebrow="07"))
    items.extend(
        lead(
            "30+ days in shop becomes a long-term concern visible to PMs and the GM. That's your cue to decide."
        )
    )
    rows = [
        ["Decision", "When to choose", "Tell"],
        ["Continue repair", "Path to service exists within a reasonable horizon.", "PM - commit to a return date."],
        ["Send to vendor", "Beyond your shop's capability.", "PM + GM - update asset record with vendor."],
        ["Retire", "Repair cost approaches replacement cost.", "GM - works with finance."],
    ]
    items.append(table(rows, col_widths=[1.5 * inch, 3.2 * inch, 2.1 * inch]))
    items.extend(
        warn(
            "Don't let an asset sit at 30+ days without a call. "
            "PMs can't plan around 'maybe.' 'Retiring this one' beats indefinite limbo."
        )
    )
    items.append(PageBreak())
    return items


def body_general_manager():
    items = section("Your cadence", eyebrow="04")
    items.extend(lead("15-20 minutes a day. The reading is the work."))

    items.extend(subsection("Monday morning (30 min)"))
    items.extend(step(1, "Dashboard, region picker on All Regions",
                      "Headline cards roll up the whole org."))
    items.extend(step(2, "Read every District Manager report",
                      "Reports → Review. Comment on at least one."))
    items.extend(step(3, "Scan escalated PM reports",
                      "DMs flag specific PM reports for your eyes."))
    items.extend(step(4, "Pick 2-3 items for the leadership call",
                      "Specifics, not generalities."))

    items.extend(subsection("Daily pulse (10 min)"))
    rows = [
        ["Metric", "Source", "Watch for"],
        ["Yardage vs. plan", "Dashboard headline", "Sharp drop without a known cause."],
        ["Open quality issues", "Quality tab", "Rising weekly trend."],
        ["Long-term shop", "Dashboard alerts", "New 30+ day entries."],
        ["Late reports", "Reports - Review", "Red flag on any role."],
    ]
    items.append(table(rows, col_widths=[1.8 * inch, 2.0 * inch, 3.0 * inch]))
    items.append(PageBreak())

    items.extend(section("General Manager report", eyebrow="05"))
    items.extend(
        lead(
            "Unlike the others, the GM report is numerical and per-plant. "
            "Eight numbers per plant. Last week and variance auto-fill."
        )
    )
    items.extend(m_gm_report())

    items.extend(subsection("Steps"))
    items.extend(step(1, "Reporting → Reports",
                      "Find the General Manager card for this week."))
    items.extend(step(2, "Fill the eight numbers for each plant",
                      "# Operators, # Runnable Trucks, Down Trucks, Operators Starting, Leaving, Training, Total Yardage, Total Hours."))
    items.extend(step(3, "Add a short note per plant",
                      "Optional but useful. One sentence."))
    items.extend(step(4, "Click Generate AI",
                      "Drafts a regional summary. Edit before submitting."))
    items.extend(step(5, "Submit",
                      "Board and reviewers notified."))
    items.extend(
        warn(
            "All eight rows per plant are required. Type 0 if the answer is zero - "
            "leaving fields blank blocks submission."
        )
    )
    items.append(PageBreak())

    items.extend(section("Reviewing reports", eyebrow="06"))
    items.extend(lead("You see every weekly report. Read them in priority order."))

    rows = [
        ["Report", "Cadence", "Your engagement"],
        ["District Manager", "Weekly (Sundays)", "Read every one. Comment on at least one."],
        ["NRMCA", "Weekly", "Compare against industry benchmarks."],
        ["Quality Control Manager", "Weekly", "Read recap. Follow up on themes."],
        ["Safety / Environmental", "Weekly", "Read every incident."],
        ["Plant Manager", "Weekly (Saturdays)", "Skim approved. Deep-dive on flagged plants."],
        ["Aggregate Production", "Weekly", "Skim totals. Investigate sharp swings."],
        ["Lost Load", "Ad-hoc", "Review patterns monthly."],
    ]
    items.append(table(rows, col_widths=[2.2 * inch, 1.6 * inch, 3.0 * inch]))
    items.extend(
        tip(
            "Public recognition. Private correction. "
            "Route corrective feedback through the DM - direct comments on a PM report "
            "undermine the DM's authority."
        )
    )
    items.append(PageBreak())

    items.extend(section("Looking across the organization", eyebrow="07"))

    items.extend(subsection("Leaderboards"))
    items.extend(
        body(
            "Ranking plants, regions, and individuals on a variety of metrics. "
            "When you spot an outlier, ask <i>what is the story behind this?</i> before drawing conclusions."
        )
    )
    rows = [
        ["Leaderboard", "Shows"],
        ["Plant Production", "Yardage and load count per plant, week over week."],
        ["Fleet Utilization", "Active vs. spare vs. shop per plant."],
        ["Quality Compliance", "Issues opened and resolved per plant."],
        ["Report Compliance", "On-time vs. late vs. missing per role."],
    ]
    items.append(table(rows, col_widths=[2.2 * inch, 4.6 * inch]))

    items.extend(subsection("NRMCA benchmarks"))
    items.extend(
        body(
            "Reporting → Calibrations &amp; Certifications. "
            "Treat industry benchmarks as context, not a target. "
            "A plant below average in a tight labor market may still be the best in its region."
        )
    )

    items.extend(subsection("Approving elevated actions"))
    items.extend(
        body(
            "Some actions require role weight above 75 (yours). DMs escalate when their permissions aren't enough."
        )
    )
    for line in [
        "Mark a new role as eligible for plant assignment.",
        "Re-open a submitted report so a PM can fix a number.",
        "Adjust district-level plant assignments after an org change.",
    ]:
        items.append(Paragraph(f"<font color='#9CA3AF'>—</font>  {line}", BODY))
    items.extend(
        warn(
            "Always confirm verbally or by email before approving. "
            "The system message alone isn't enough context."
        )
    )
    items.append(PageBreak())
    return items


# ── Role specs ─────────────────────────────────────────────────


PLANT_MANAGER = {
    "role_label": "Plant Manager",
    "role_tagline": "Every shift, every truck, every yard.",
    "output_file": "Smyrna_Tools_Training_Plant_Manager.pdf",
    "summary": [
        "You run the day at your plant. Smyrna Tools is the screen you keep open - "
        "it tracks every asset, every operator, and every report tied to your facility.",
        "This packet is short on theory and long on exact button clicks. "
        "It's designed to make you self-sufficient in one read.",
    ],
    "responsibilities": [
        "Submit the Plant Manager Report every Saturday.",
        "Keep asset statuses current the day they change.",
        "File a Lost Load Report when a load is spilled, returned, or rejected.",
        "File a Quality Issue when concrete is delivered but defective.",
        "Coordinate operator-sharing with neighbor plants and log it.",
    ],
    "quick_daily": [
        {"title": "Open the Dashboard", "body": "Scan Alerts and Fleet. Anything red is your first decision."},
        {"title": "Update asset statuses", "body": "Active / Spare / In Shop / Retired - same day, every change."},
        {"title": "Clear Notifications", "body": "Bell icon. Each item deep-links to the screen that needs you."},
    ],
    "quick_weekly": [
        {"title": "Saturday: submit weekly report", "body": "Reporting → Reports → Plant Manager card."},
        {"title": "Monday: read DM feedback", "body": "Fix anything returned to draft and resubmit."},
    ],
    "quick_screens": [
        {"need": "Submit weekly report", "screen": "Reports hub", "path": "Reporting → Reports"},
        {"need": "Change mixer status", "screen": "Mixer detail", "path": "Assets → Mixers"},
        {"need": "Report a spilled load", "screen": "Lost Load modal", "path": "Reporting → Reports → Quick Rail"},
        {"need": "File a quality issue", "screen": "Quality Issue modal", "path": "Reporting → Reports → Quality"},
        {"need": "See trucks in shop", "screen": "Dashboard - Fleet", "path": "Dashboard"},
        {"need": "Check shop alerts", "screen": "Dashboard - Alerts", "path": "Dashboard"},
    ],
    "dashboard_intro": (
        "Your Dashboard shows just your plant. The Alerts card is the most important - "
        "anything red is a decision before dispatch finalizes."
    ),
    "body_builder": body_plant_manager,
}


DISTRICT_MANAGER = {
    "role_label": "District Manager",
    "role_tagline": "Multi-plant oversight. Weekly cadence. District-wide accountability.",
    "output_file": "Smyrna_Tools_Training_District_Manager.pdf",
    "summary": [
        "You are accountable for the operational health of every plant in your district. "
        "Smyrna Tools rolls up the whole district into one view, "
        "plus the review queue you use to keep PM reports honest.",
        "This packet covers your weekly rhythm, the Review tab top to bottom, "
        "and the admin actions only DMs can take.",
    ],
    "responsibilities": [
        "Submit the District Manager Report every Sunday.",
        "Review and approve every Plant Manager Report before Monday.",
        "Monitor district-wide utilization, spare ratios, and long-term shop assets.",
        "Coordinate cross-plant operator sharing.",
        "Assign Plant Managers and Shop Managers to the correct plants.",
    ],
    "quick_daily": [
        {"title": "Dashboard - district view", "body": "Scan Alerts for red items across every plant."},
        {"title": "Quality tab", "body": "New issues show with a red dot."},
        {"title": "Clear Notifications", "body": "Bell icon. Each one deep-links."},
    ],
    "quick_weekly": [
        {"title": "Sunday: submit DM Report", "body": "Six weekday recaps. About 30 minutes."},
        {"title": "Sunday + Monday: review PM Reports", "body": "Read all. Approve or return-to-draft with a reason."},
    ],
    "quick_screens": [
        {"need": "Submit your DM Report", "screen": "Reports hub", "path": "Reporting → Reports"},
        {"need": "Approve PM Reports", "screen": "Review tab", "path": "Reporting → Reports → Review"},
        {"need": "Assign plants to a manager", "screen": "Manager detail", "path": "People → Managers"},
        {"need": "District fleet rollup", "screen": "Dashboard - Fleet", "path": "Dashboard"},
        {"need": "Compare plants", "screen": "Leaderboards", "path": "Dashboard - Fleet section"},
    ],
    "dashboard_intro": (
        "Switch the region picker to your district view. "
        "The Alerts and People sections are your morning anchors."
    ),
    "body_builder": body_district_manager,
}


SHOP_MANAGER = {
    "role_label": "Shop Manager",
    "role_tagline": "Maintenance, inspections, shop throughput.",
    "output_file": "Smyrna_Tools_Training_Shop_Manager.pdf",
    "summary": [
        "You own the maintenance lifecycle of every rolling and stationary asset. "
        "The Maintenance module is your floor system: due/overdue work, history, review queue, form templates.",
        "This packet covers the Maintenance Log top to bottom and the calls you make "
        "when an asset has been in the shop too long.",
    ],
    "responsibilities": [
        "Triage the Maintenance Log every morning - Overdue first, Due Soon second.",
        "Move assets to and from In Shop status the moment they arrive and depart.",
        "Review and approve technician submissions.",
        "Author and maintain form templates.",
        "Generate regulatory PDFs on the day an inspection completes.",
    ],
    "quick_daily": [
        {"title": "Open the Maintenance Log", "body": "Filter to Overdue. Then Due Soon. That's today."},
        {"title": "Mark arriving assets In Shop", "body": "Same minute the truck rolls in."},
        {"title": "Clear Pending Reviews", "body": "These bottleneck the technicians. Move them daily."},
    ],
    "quick_weekly": [
        {"title": "Audit form templates", "body": "Field skipped 80% of the time? Make it optional or remove."},
        {"title": "Long-term shop review", "body": "Anything past 30 days needs a decision."},
    ],
    "quick_screens": [
        {"need": "See today's work", "screen": "Maintenance Log - Overdue", "path": "Reporting → Maintenance"},
        {"need": "Mark asset In Shop", "screen": "Asset detail", "path": "Assets → (type) → row"},
        {"need": "Review a submission", "screen": "Pending Reviews rail", "path": "Reporting → Maintenance"},
        {"need": "Create new form", "screen": "Manage Forms tab", "path": "Reporting → Maintenance → Manage Forms"},
        {"need": "Generate inspection PDF", "screen": "Approved submission", "path": "Reporting → Maintenance"},
    ],
    "dashboard_intro": (
        "The Dashboard gives useful context, but your real home screen is the Maintenance Log. "
        "Bookmark it."
    ),
    "body_builder": body_shop_manager,
}


GENERAL_MANAGER = {
    "role_label": "General Manager",
    "role_tagline": "Strategic visibility. Weekly accountability. The whole org, on one screen.",
    "output_file": "Smyrna_Tools_Training_General_Manager.pdf",
    "summary": [
        "You have the broadest view in Smyrna Tools - every region, every plant, every report. "
        "The platform is built to give you the data you need to lead without chasing spreadsheets.",
        "This packet covers your weekly cadence, the per-plant GM Report, "
        "and the cross-region screens where you spend most of your time.",
    ],
    "responsibilities": [
        "Submit the General Manager Report every Sunday - per-plant detail across the org.",
        "Review District Manager Reports and any escalated PM Reports.",
        "Monitor company-wide KPIs - yardage, utilization, quality, lost loads.",
        "Approve elevated actions when DMs escalate.",
        "Set the tone for data quality with your own report.",
    ],
    "quick_daily": [
        {"title": "Dashboard - All Regions", "body": "Headline cards roll up the whole org. 60-second read."},
        {"title": "Late reports", "body": "Anyone past their deadline shows in red."},
        {"title": "Long-term shop watch", "body": "New entries here are the leading indicator of asset issues."},
    ],
    "quick_weekly": [
        {"title": "Monday: read every DM Report", "body": "Reports → Review. Comment publicly on at least one."},
        {"title": "Sunday: submit GM Report", "body": "Eight numbers per plant, plus the AI summary."},
    ],
    "quick_screens": [
        {"need": "Submit GM Report", "screen": "Reports hub", "path": "Reporting → Reports"},
        {"need": "Read DM Reports", "screen": "Review tab", "path": "Reporting → Reports → Review"},
        {"need": "All-region rollup", "screen": "Dashboard", "path": "Dashboard (All Regions)"},
        {"need": "Industry benchmarks", "screen": "NRMCA module", "path": "Reporting → Calibrations & Certifications"},
        {"need": "Approve elevated action", "screen": "Admin screen", "path": "Admin → (section)"},
    ],
    "dashboard_intro": (
        "Switch the region picker to All Regions. "
        "The headline cards are designed for a 60-second read."
    ),
    "body_builder": body_general_manager,
}


# ── Build ──────────────────────────────────────────────────────


def build_packet(spec):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / spec["output_file"]
    doc = SimpleDocTemplate(
        str(out),
        pagesize=LETTER,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.75 * inch,
        title=f"Smyrna Tools - {spec['role_label']} Training",
        author="Smyrna Tools",
    )

    story = []
    story.extend(build_cover(spec["role_label"], spec["role_tagline"]))
    story.extend(
        build_at_a_glance(
            spec["role_label"],
            spec["quick_daily"],
            spec["quick_weekly"],
            spec["quick_screens"],
        )
    )
    story.extend(build_welcome(spec["role_label"], spec["summary"], spec["responsibilities"]))
    story.extend(build_getting_started())
    story.extend(build_dashboard(spec["dashboard_intro"]))
    story.extend(spec["body_builder"]())
    story.extend(build_troubleshooting())
    story.extend(build_help())
    story.extend(build_acknowledgement(spec["role_label"]))

    on_later = page_chrome_factory(spec["role_label"])
    doc.build(story, onFirstPage=cover_page, onLaterPages=on_later)
    return out


def main():
    for spec in (PLANT_MANAGER, DISTRICT_MANAGER, SHOP_MANAGER, GENERAL_MANAGER):
        out = build_packet(spec)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()

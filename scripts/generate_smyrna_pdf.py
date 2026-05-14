"""Minimal, accurate cost-estimate PDF for the Smyrna Tools build."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUTPUT = Path(__file__).resolve().parent.parent / "Smyrna_Tools_Cost_Estimate.pdf"

INK = colors.HexColor("#111111")
MUTED = colors.HexColor("#666666")
RULE = colors.HexColor("#DDDDDD")
ZEBRA = colors.HexColor("#FAFAFA")

title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=22, textColor=INK, leading=26, spaceAfter=2)
sub = ParagraphStyle("s", fontName="Helvetica", fontSize=10, textColor=MUTED, leading=14, spaceAfter=14)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, textColor=INK, leading=14, spaceBefore=12, spaceAfter=4)
note = ParagraphStyle("n", fontName="Helvetica-Oblique", fontSize=8.5, textColor=MUTED, leading=12, spaceBefore=12)

RATE = 175

LINES = [
    # (Category, Item, Hours)
    ("Discovery & PM", "Requirements gathering, stakeholder interviews, workshops", 80),
    ("Discovery & PM", "Technical architecture, data modeling, integration design", 80),
    ("Discovery & PM", "Project management across full build (~12% of dev)", 480),
    ("Discovery & PM", "Sprint planning, demos, change requests", 120),

    ("Design", "UX research, journey maps, IA for 7 functional areas", 120),
    ("Design", "Wireframes for 60+ unique screens", 180),
    ("Design", "Hi-fi UI in Figma, design system, light + dark themes", 220),
    ("Design", "Component library specs, tokens, Tailwind theming", 80),
    ("Design", "Iconography, charting design, motion/interaction specs", 60),
    ("Design", "Responsive review across breakpoints + iPad/mobile", 60),

    ("Frontend — Shell", "App shell, routing, lazy-loading with retry, PWA + manifest", 80),
    ("Frontend — Shell", "Auth flow, custom session handling, offline/terminated overlays", 80),
    ("Frontend — Shell", "Region/role-based view gating, navigation, tutorial system", 100),
    ("Frontend — Shell", "Version check + PWA update notification, presence/realtime hooks", 60),
    ("Frontend — Shell", "Theme mode, accent color, magnetic hover, particles background", 60),

    ("Frontend — Assets", "Mixers list + detail + history + images + comments", 160),
    ("Frontend — Assets", "Tractors list + detail + history + comments", 120),
    ("Frontend — Assets", "Trailers list + detail + comments", 90),
    ("Frontend — Assets", "Equipment list + detail + history + comments", 110),
    ("Frontend — Assets", "Pickup trucks list + detail + comments", 80),
    ("Frontend — Assets", "Shared asset filters, verification, stats, pagination", 90),

    ("Frontend — People", "Operators CRUD, history, exclusion reasons, exports", 110),
    ("Frontend — People", "Managers, district managers, role assignment", 90),

    ("Frontend — Admin", "Regions admin (with type variants: Office/Aggregate/default)", 60),
    ("Frontend — Admin", "Plants admin + plant-to-plant distances, picker, notifications", 90),
    ("Frontend — Admin", "Roles admin, permissions UI", 70),

    ("Frontend — Reporting", "Reports landing, summary bar, modals host, skeletons", 110),
    ("Frontend — Reporting", "Weekly Ready-Mix Instructor report (1.5k LOC, complex form)", 120),
    ("Frontend — Reporting", "Weekly Plant Manager report (1.4k LOC)", 110),
    ("Frontend — Reporting", "Weekly General Manager report (1.1k LOC)", 90),
    ("Frontend — Reporting", "Weekly Aggregate Production report", 70),
    ("Frontend — Reporting", "Weekly District Manager report", 70),
    ("Frontend — Reporting", "Weekly Efficiency report", 60),
    ("Frontend — Reporting", "Weekly Quality Control Manager report", 70),
    ("Frontend — Reporting", "Weekly Safety Manager report", 60),
    ("Frontend — Reporting", "Reports submit flow, variance, review, validation", 120),
    ("Frontend — Reporting", "Quality reports list + quality issues management", 80),
    ("Frontend — Reporting", "List view (1.3k LOC), maintenance log + filters", 130),
    ("Frontend — Reporting", "NRMCA reports (industry benchmarking)", 90),

    ("Frontend — Plan", "Plan dashboard view + insights + statistics", 140),
    ("Frontend — Plan", "Plan flow editor + preview metrics + layout engine", 180),
    ("Frontend — Plan", "Plan schedule view (1k LOC) + scroll spy + sync", 130),
    ("Frontend — Plan", "Plan demand view + runtime calculations", 100),
    ("Frontend — Plan", "Book Order view (1.6k LOC) + travel pairs + live travel times", 200),
    ("Frontend — Plan", "Call List view + detail orders + closer plant lookup", 110),
    ("Frontend — Plan", "Plan settings, notes formatter, copy utility", 70),
    ("Frontend — Plan", "Address distances, geocoding integration, plant-to-plant matrix", 100),

    ("Frontend — Tools", "Calculator suite (multiple calc types)", 80),
    ("Frontend — Tools", "Documents view + document service integration", 70),
    ("Frontend — Tools", "Dispatch import (CSV upload, parser UI, preview, validation)", 110),

    ("Frontend — Common", "My Account (1.9k LOC: profile, prefs, security, devices)", 130),
    ("Frontend — Common", "Notifications center (1.5k LOC)", 110),
    ("Frontend — Common", "Dashboard (managers, schedule, stats, chat)", 160),
    ("Frontend — Common", "Login, sign-up, reset password, session management UI", 80),
    ("Frontend — Common", "Leaderboards + Recharts visualizations", 80),
    ("Frontend — Common", "Excel + PDF export modules (operators, issues, reports)", 110),
    ("Frontend — Common", "Maintenance PDF form generator", 70),

    ("Hooks & Utilities", "60+ custom React hooks (data, forms, realtime, layout)", 240),
    ("Hooks & Utilities", "40+ utility modules (date, format, validation, geocoding, etc.)", 220),
    ("Hooks & Utilities", "4 React contexts (auth, prefs, messages, tutorial)", 60),

    ("Backend — Edge fns", "Auth service (626 LOC): sign-in/up, reset, sessions, bcrypt", 80),
    ("Backend — Edge fns", "Auth context, session validation middleware, shared helpers", 60),
    ("Backend — Edge fns", "Database service: sanitized CRUD, allowlists, injection guards", 80),
    ("Backend — Edge fns", "Email service (898 LOC): templates, dispatch, queueing", 90),
    ("Backend — Edge fns", "Dispatch import + parsers (1.3k LOC combined)", 140),
    ("Backend — Edge fns", "Asset services (mixer/tractor/trailer/equipment/pickup): 5 fns", 200),
    ("Backend — Edge fns", "Operator service, plant service, region service, role-related", 100),
    ("Backend — Edge fns", "Report service + book-order-log service + plan service", 140),
    ("Backend — Edge fns", "Maintenance, list, notification, document services", 120),
    ("Backend — Edge fns", "AI service (chat, dashboard assistant) + integration", 100),
    ("Backend — Edge fns", "Geocoding service + traffic service + live travel times", 100),
    ("Backend — Edge fns", "District manager, quality-issues, user-preferences, presence", 100),
    ("Backend — Edge fns", "Error reporting, crypto utility, user utility, NRMCA service", 80),

    ("Database", "Schema design — ~25+ tables, FKs, indexes, history tables", 120),
    ("Database", "RLS policies (allow-all + edge-fn enforcement model)", 30),
    ("Database", "Migrations (versioned, multiple revisions across release)", 60),
    ("Database", "Seed data, dev fixtures, environment promotion", 40),

    ("Integrations", "Sentry: init, releases, source maps, scoped user/region events", 30),
    ("Integrations", "Vercel Analytics + Speed Insights", 12),
    ("Integrations", "Supabase storage (mixer images, documents)", 30),
    ("Integrations", "Supabase realtime channels (presence, live updates)", 40),
    ("Integrations", "Mapping / geocoding provider integration", 50),
    ("Integrations", "AI provider (OpenAI/Anthropic) integration + prompt design", 60),

    ("Quality", "Jest + RTL unit and integration tests, mocking patterns", 160),
    ("Quality", "CI workflow (GitHub Actions test pipeline)", 20),
    ("Quality", "Manual QA, regression passes, cross-browser/device", 160),
    ("Quality", "Accessibility audit + remediation (WCAG AA pass)", 80),
    ("Quality", "Performance profiling, bundle analysis, virtualization", 60),
    ("Quality", "Security review (allowlist hardening, injection, secrets audit)", 60),

    ("DevOps & release", "CI/CD pipelines, preview deploys, env management", 60),
    ("DevOps & release", "CalVer release tool (calver.js), changelog automation", 30),
    ("DevOps & release", "Supabase function deploy scripts (--no-verify-jwt), bridge tooling", 40),
    ("DevOps & release", "Production monitoring + alert setup", 30),
    ("DevOps & release", "Documentation, runbooks, handoff, end-user training", 100),
]

CONTINGENCY_PCT = 0.15

def money(n):
    return f"${n:,.0f}"

def build():
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=LETTER,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.55 * inch, bottomMargin=0.55 * inch,
    )

    story = [
        Paragraph("Smyrna Tools — Cost Estimate", title),
        Paragraph(
            f"Itemized agency build estimate at a ${RATE}/hr blended rate. "
            "Scope: React 19 PWA (~97k LOC) + 39 Supabase edge functions (~11k LOC), "
            "custom session auth, 7 functional areas, 8 weekly report builders, "
            "full plan/dispatch suite with live geocoding and travel-time routing, "
            "AI assistant, Sentry, PWA, CI.",
            sub,
        ),
    ]

    by_cat, order = {}, []
    for cat, item, hrs in LINES:
        if cat not in by_cat:
            by_cat[cat] = []
            order.append(cat)
        by_cat[cat].append((item, hrs))

    grand_hours = 0
    grand_cost = 0

    for cat in order:
        rows = [["Item", "Hours", "Cost"]]
        cat_hours = 0
        for item, hrs in by_cat[cat]:
            cost = hrs * RATE
            cat_hours += hrs
            rows.append([item, f"{hrs}", money(cost)])
        cat_cost = cat_hours * RATE
        grand_hours += cat_hours
        grand_cost += cat_cost
        rows.append(["Subtotal", f"{cat_hours}", money(cat_cost)])

        story.append(Paragraph(cat, h2))
        t = Table(rows, colWidths=[5.3 * inch, 0.8 * inch, 1.2 * inch], hAlign="LEFT")
        style = TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, -1), INK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, INK),
            ("LINEABOVE", (0, -1), (-1, -1), 0.5, RULE),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ])
        for i in range(1, len(rows) - 1):
            if i % 2 == 0:
                style.add("BACKGROUND", (0, i), (-1, i), ZEBRA)
        t.setStyle(style)
        story.append(t)

    contingency = grand_cost * CONTINGENCY_PCT
    total = grand_cost + contingency

    story.append(Spacer(1, 16))
    totals = Table(
        [
            ["Development subtotal", f"{grand_hours:,} hrs", money(grand_cost)],
            [f"Contingency ({int(CONTINGENCY_PCT * 100)}%)", "", money(contingency)],
            ["Estimated total", "", money(total)],
        ],
        colWidths=[5.3 * inch, 0.8 * inch, 1.2 * inch],
        hAlign="LEFT",
    )
    totals.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, INK),
        ("LINEABOVE", (0, -1), (-1, -1), 1, INK),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(totals)

    story.append(Paragraph(
        "Excludes ongoing hosting (Supabase, Vercel, Sentry, AI provider, mapping/geocoding), "
        "third-party licenses, and post-launch maintenance/retainer. "
        "Single-vendor delivery assumed; multi-vendor or fixed-bid contracts typically add 15–25%.",
        note,
    ))

    doc.build(story)
    print(f"Wrote {OUTPUT}")
    print(f"Hours: {grand_hours:,}  Subtotal: {money(grand_cost)}  Total: {money(total)}")

if __name__ == "__main__":
    build()

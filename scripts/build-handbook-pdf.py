#!/usr/bin/env python3
"""
Render docs/Developer-Handbook.md to docs/Developer-Handbook.pdf.

    pip install --break-system-packages weasyprint markdown pygments
    python3 scripts/build-handbook-pdf.py

The Markdown is canonical. This script only presents it.

── on diagrams ──────────────────────────────────────────────────────────────
The Markdown holds Mermaid, which is the right source form: it renders on
GitHub, it diffs as text, and a developer can edit it without a drawing tool.

Mermaid needs a browser to rasterise, and requiring headless Chromium to build a
PDF is a dependency out of proportion to the job. So each Mermaid block is
replaced here by a hand-authored SVG of the same content, matched by the order
the blocks appear in the document.

That means the two can drift. `SVG_DIAGRAMS` is therefore length-checked against
the number of Mermaid blocks found, and the build fails loudly if a diagram is
added to the Markdown without a print counterpart — a silently missing figure in
a 70-page PDF is not something anyone would notice.
"""
import re
import sys
import pathlib

try:
    import markdown
    from weasyprint import HTML
except ImportError:
    sys.exit("Missing dependencies. Run:\n"
             "  pip install --break-system-packages weasyprint markdown pygments")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "Developer-Handbook.md"
OUT = ROOT / "docs" / "Developer-Handbook.pdf"

# Brand tokens, lifted from src/app/globals.css so print matches the product.
INK = "#211E1B"
ACCENT = "#9D5C64"
SOFT = "#F6EDEE"
LINE = "#E2DCD3"
SAGE = "#EFF3EC"
SAGE_LINE = "#7E9B6B"


# ── a small declarative SVG builder ──────────────────────────────────────────

def _box(x, y, w, h, label, fill=SOFT, stroke=ACCENT, sub=None):
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" '
           f'fill="{fill}" stroke="{stroke}" stroke-width="1.1"/>')
    ty = y + h / 2 + (0 if sub is None else -5)
    out += (f'<text x="{x + w/2}" y="{ty + 4}" font-family="Helvetica,Arial" '
            f'font-size="10.5" text-anchor="middle" fill="{INK}">{label}</text>')
    if sub:
        out += (f'<text x="{x + w/2}" y="{ty + 17}" font-family="Helvetica,Arial" '
                f'font-size="8.5" text-anchor="middle" fill="{INK}" opacity=".7">{sub}</text>')
    return out


def _arrow(x1, y1, x2, y2, label=None, dashed=False):
    dash = ' stroke-dasharray="4 3"' if dashed else ""
    out = (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{ACCENT}" '
           f'stroke-width="1.2"{dash}/>')
    # arrowhead, oriented along the segment
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    p = []
    for ang in (a + 2.7, a - 2.7):
        p.append(f"{x2 + 8*math.cos(ang):.1f},{y2 + 8*math.sin(ang):.1f}")
    out += f'<polygon points="{x2},{y2} {" ".join(p)}" fill="{ACCENT}"/>'
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        out += (f'<text x="{mx}" y="{my - 5}" font-family="Helvetica,Arial" '
                f'font-size="8" text-anchor="middle" fill="{INK}" opacity=".75">{label}</text>')
    return out


def svg(w, h, body):
    return (f'<svg class="fig" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'xmlns="http://www.w3.org/2000/svg">{body}</svg>')


def _flow_rows(rows, w=640, box_w=150, box_h=44, gap_y=34):
    """Vertical stack of horizontal rows of boxes, arrows between rows."""
    body = ""
    h = len(rows) * box_h + (len(rows) - 1) * gap_y + 8
    for ri, row in enumerate(rows):
        y = 4 + ri * (box_h + gap_y)
        n = len(row)
        span = n * box_w + (n - 1) * 20
        x0 = (w - span) / 2
        for ci, cell in enumerate(row):
            label, sub, fill, stroke = cell
            x = x0 + ci * (box_w + 20)
            body += _box(x, y, box_w, box_h, label, fill, stroke, sub)
        if ri < len(rows) - 1:
            body += _arrow(w / 2, y + box_h, w / 2, y + box_h + gap_y - 2)
    return svg(w, h, body)


A = (SOFT, ACCENT)
G = (SAGE, SAGE_LINE)
N = ("#FFFFFF", LINE)


# ── the ten figures, in document order ───────────────────────────────────────

def fig_system():
    b = ""
    b += _box(245, 4, 150, 40, "Browser", *A, sub="planner · admin · guest")
    b += _arrow(320, 44, 320, 74)
    b += _box(150, 74, 340, 116, "", "#FCFAF7", LINE)
    b += (f'<text x="320" y="92" font-family="Helvetica,Arial" font-size="9" '
          f'text-anchor="middle" fill="{INK}" opacity=".6">VERCEL — NEXT.JS 15 APP ROUTER</text>')
    b += _box(163, 100, 100, 34, "middleware", *N)
    b += _box(271, 100, 100, 34, "pages (RSC)", *N)
    b += _box(379, 100, 98, 34, "actions / api", *N)
    b += _box(220, 146, 200, 34, "service layer", *G, sub=None)
    b += _arrow(320, 190, 320, 218)
    for i, (lbl, x) in enumerate([("Neon", 40), ("Resend", 158), ("Blob/S3", 276),
                                  ("Upstash", 394), ("Stripe", 512)]):
        b += _box(x, 218, 96, 38, lbl, *A)
    b += _arrow(560, 218, 470, 134, "signed webhook", dashed=True)
    return svg(640, 270, b)


def fig_repo():
    b = ""
    b += _box(20, 10, 180, 150, "", "#FCFAF7", LINE)
    b += (f'<text x="110" y="28" font-family="Helvetica,Arial" font-size="9" '
          f'text-anchor="middle" fill="{INK}" opacity=".6">src/app — ROUTES</text>')
    for i, t in enumerate(["(marketing)", "studio/", "admin/", "w/ · invite/", "api/"]):
        b += _box(34, 36 + i * 24, 152, 20, t, *N)
    b += _box(250, 36, 170, 44, "src/server/services", *G, sub="26 modules")
    b += _box(250, 108, 170, 44, "src/lib", *A, sub="infrastructure")
    b += _box(470, 36, 150, 44, "src/components", *N, sub="shared UI")
    b += _arrow(200, 70, 248, 58)
    b += _arrow(335, 80, 335, 106)
    b += _arrow(200, 110, 248, 128)
    b += _arrow(200, 50, 468, 50)
    return svg(640, 172, b)


def fig_er():
    b = ""
    b += _box(240, 6, 160, 40, "Studio", *A, sub="the tenant")
    for i, (lbl, x) in enumerate([("User", 20), ("Wedding", 160), ("Payment", 300),
                                  ("Subscription", 440), ("SupportTicket", 560)]):
        w = 110 if i < 4 else 70
        b += _box(x, 86, 110, 34, lbl, *N)
        b += _arrow(320, 46, x + 55, 84)
    for i, (lbl, x) in enumerate([("Guest", 20), ("Event", 150), ("Photo", 280),
                                  ("RegistryItem", 410), ("Table", 540)]):
        b += _box(x, 162, 110, 34, lbl, *G)
        b += _arrow(215, 120, x + 55, 160)
    b += _box(20, 234, 110, 34, "Rsvp", *N)
    b += _box(150, 234, 110, 34, "Seat", *N)
    b += _arrow(75, 196, 75, 232)
    b += _arrow(205, 196, 205, 232)
    b += (f'<text x="400" y="252" font-family="Helvetica,Arial" font-size="8.5" '
          f'fill="{INK}" opacity=".65">No FK, cleaned up explicitly: '
          f'AuditLog · EmailLog · IdempotencyKey</text>')
    return svg(640, 278, b)


def fig_auth():
    steps = [
        ("1", "Planner submits email + password"),
        ("2", "gateLogin() — per-account 10/15m, per-IP 30/15m"),
        ("3", "applyDelay() — escalating, before the password is checked"),
        ("4", "signIn('credentials') → bcrypt.compare (DUMMY_HASH if no user)"),
        ("5", "JWT issued with issuedAt; __Host- cookie set"),
        ("6", "clearLoginFailures() on the redirect path"),
        ("7", "/continue → /studio or /admin by role"),
    ]
    b = ""
    for i, (n, t) in enumerate(steps):
        y = 6 + i * 36
        b += _box(20, y, 26, 26, n, SAGE, SAGE_LINE)
        b += _box(56, y, 564, 26, "", "#FFFFFF", LINE)
        b += (f'<text x="70" y="{y + 17}" font-family="Helvetica,Arial" '
              f'font-size="10" fill="{INK}">{t}</text>')
        if i < len(steps) - 1:
            b += _arrow(33, y + 26, 33, y + 36)
    return svg(640, 6 + len(steps) * 36, b)


def fig_publish():
    return _flow_rows([
        [("Planner clicks Publish", None, *A)],
        [("requireStudio()", None, *N)],
        [("active subscription?", "yes → publish free", *G)],
        [("first wedding free?", "compare-and-swap claim", *G)],
        [("resolvePrice()", "override → global default", *N)],
        [("amountCents == 0?", "yes → publish, no charge", *G)],
        [("billing unavailable?", "yes → UserError, nothing published", *A)],
        [("Stripe Checkout", "webhook → PUBLISHED", *N)],
    ], box_w=300, gap_y=24)


def fig_invite():
    steps = [
        ("1", "Planner presses Send invitations — button disables"),
        ("2", "Server Action → requireStudio()"),
        ("3", "sendInvitationsOutcome() → sendInvitations()"),
        ("4", "SELECT guests WHERE weddingId, studioId, invitedAt IS NULL"),
        ("5", "per guest: runOnce(invitationKey) → emailOneGuest() → Resend"),
        ("6", "EmailLog row written: SENT / FAILED / SKIPPED"),
        ("7", "invitedAt stamped only on success — failures retry next press"),
        ("8", "outcome returned: '12 invitations sent'"),
    ]
    b = ""
    for i, (n, t) in enumerate(steps):
        y = 6 + i * 36
        b += _box(20, y, 26, 26, n, SAGE, SAGE_LINE)
        b += _box(56, y, 564, 26, "", "#FFFFFF", LINE)
        b += (f'<text x="70" y="{y + 17}" font-family="Helvetica,Arial" '
              f'font-size="10" fill="{INK}">{t}</text>')
        if i < len(steps) - 1:
            b += _arrow(33, y + 26, 33, y + 36)
    return svg(640, 6 + len(steps) * 36, b)


def fig_rsvp():
    return _flow_rows([
        [("Guest opens /invite/[code]", None, *A)],
        [("lookup by inviteCode", None, *N)],
        [("wedding PUBLISHED?", "no → notFound() 404", *G)],
        [("render personal portal", "only their events", *N)],
        [("rateLimit rsvp:code — 6 / 60s", None, *G)],
        [("zRsvp.parse() → submitRsvp()", None, *N)],
        [("Rsvp upsert, keyed on guestId", None, *A)],
    ], box_w=300, gap_y=22)


def fig_upload():
    return _flow_rows([
        [("Planner selects a file", None, *A)],
        [("requireStudio() → ownWedding()", None, *N)],
        [("rateLimit upload:studioId — 120 / hour", None, *G)],
        [("processImage() — sharp: variants, blur, tone", None, *N)],
        [("key = studios/{studioId}/weddings/{weddingId}/{uuid}", None, *N)],
        [("storage().put() — blob | s3 | local", None, *G)],
        [("Photo row written; failure → deletePrefix cleanup", None, *A)],
    ], box_w=340, gap_y=22)


def fig_deploy():
    return _flow_rows([
        [("git push origin main", None, *A)],
        [("prisma generate", None, *N)],
        [("prisma migrate deploy → Neon", "runs before the build", *G)],
        [("next build", "fails → previous deployment keeps serving", *N)],
        [("instrumentation.register() → assertEnv()", "runtime, not build time", *G)],
        [("Ready — verify /api/ready", None, *A)],
    ], box_w=320, gap_y=24)


def fig_lifecycle():
    b = ""
    b += _box(30, 40, 130, 44, "DRAFT", *N, sub="private to studio")
    b += _box(250, 40, 130, 44, "PUBLISHED", *G, sub="live at /w/[slug]")
    b += _box(470, 40, 140, 44, "ARCHIVED", "#F4F2EF", LINE, sub="never set by any code")
    b += _arrow(160, 56, 248, 56, "startPublish()")
    b += _arrow(248, 74, 160, 74, "unpublishWedding()")
    b += (f'<text x="540" y="112" font-family="Helvetica,Arial" font-size="8.5" '
          f'text-anchor="middle" fill="{INK}" opacity=".6">enum value only</text>')
    b += _box(30, 120, 130, 30, "preview route", *A)
    b += _arrow(95, 84, 95, 118)
    return svg(640, 162, b)


def fig_legal():
    return _flow_rows([
        [("Planner signs in → /studio", None, *A)],
        [("requireStudio()", None, *N)],
        [("requireStudioSession()", "session · PLANNER · studio ACTIVE", *N)],
        [("hasAcceptedCurrentLegal(userId)", "both current versions?", *G)],
        [("no → redirect /accept-terms", "un-gated: requireStudioSession() only", *A)],
        [("unchecked checkbox + links", "server ignores a form without accept=yes", *G)],
        [("acceptCurrentLegal()", "createMany, skipDuplicates", *N)],
        [("two rows written · audit entry · dashboard", None, *G)],
    ], box_w=340, gap_y=22)


SVG_DIAGRAMS = [
    fig_system,      # 1.3  system architecture
    fig_repo,        # 2.2  repository architecture
    fig_auth,        # 5.2  authentication sequence
    fig_invite,      # 5.3  invitation / email sequence
    fig_rsvp,        # 5.4  RSVP flow
    fig_publish,     # 5.5  publishing sequence
    fig_legal,       # 5.8  legal acceptance flow
    fig_upload,      # 5.7  upload / storage flow
    fig_er,          # 6.1  entity relationship
    fig_lifecycle,   # 8    wedding lifecycle
    fig_deploy,      # 14.2 deployment flow
]


# ── build ────────────────────────────────────────────────────────────────────

CSS = f"""
@page {{
  size: A4;
  margin: 20mm 17mm 18mm 17mm;
  @top-right {{
    content: "EventOS Developer Handbook";
    font-family: Helvetica, Arial; font-size: 8pt; color: #8a827a;
  }}
  @bottom-center {{
    content: counter(page);
    font-family: Helvetica, Arial; font-size: 9pt; color: #8a827a;
  }}
}}
@page :first {{ @top-right {{ content: ""; }} }}

body {{ font-family: "DejaVu Serif", Georgia, serif; font-size: 9.6pt;
        line-height: 1.5; color: {INK}; }}
h1 {{ font-size: 21pt; margin: 1.6em 0 .5em; color: {INK};
      border-bottom: 2px solid {ACCENT}; padding-bottom: .22em;
      page-break-after: avoid; page-break-before: always; }}
h1:first-of-type {{ page-break-before: avoid; }}
h2 {{ font-size: 14pt; margin: 1.5em 0 .4em; color: {ACCENT};
      page-break-after: avoid; }}
h3 {{ font-size: 11.5pt; margin: 1.2em 0 .3em; page-break-after: avoid; }}
h4 {{ font-size: 10pt; margin: 1em 0 .3em; }}
p, li {{ orphans: 2; widows: 2; }}
a {{ color: {ACCENT}; text-decoration: none; }}
code {{ font-family: "DejaVu Sans Mono", monospace; font-size: 8.4pt;
        background: {SOFT}; padding: .5pt 3pt; border-radius: 2pt; }}
pre {{ background: #FBF9F6; border: 1px solid {LINE}; border-left: 2.5pt solid {ACCENT};
       border-radius: 3pt; padding: 7pt 9pt; font-size: 8pt; line-height: 1.4;
       overflow-wrap: break-word; white-space: pre-wrap; page-break-inside: avoid; }}
pre code {{ background: none; padding: 0; font-size: 8pt; }}
table {{ border-collapse: collapse; width: 100%; margin: .8em 0; font-size: 8.5pt;
         page-break-inside: avoid; }}
th {{ background: {SOFT}; text-align: left; padding: 4pt 6pt;
      border-bottom: 1.2pt solid {ACCENT}; font-family: Helvetica, Arial; font-size: 8pt; }}
td {{ padding: 4pt 6pt; border-bottom: .6pt solid {LINE}; vertical-align: top; }}
blockquote {{ margin: .9em 0; padding: 7pt 11pt; background: {SAGE};
              border-left: 2.5pt solid {SAGE_LINE}; border-radius: 3pt;
              page-break-inside: avoid; }}
blockquote p {{ margin: .25em 0; }}
svg.fig {{ display: block; margin: 1.1em auto; max-width: 100%;
           page-break-inside: avoid; }}
hr {{ border: none; border-top: .6pt solid {LINE}; margin: 1.6em 0; }}
ul, ol {{ padding-left: 1.15em; }}
.cover {{ text-align: center; padding-top: 26vh; page-break-after: always; }}
.cover h1 {{ font-size: 30pt; border: none; page-break-before: avoid; margin-bottom: .1em; }}
.cover .sub {{ font-size: 12pt; color: {ACCENT}; margin-bottom: 2.4em; }}
.cover .meta {{ font-size: 9pt; color: #6d665f; line-height: 1.9; }}
"""


def main():
    md_text = SRC.read_text(encoding="utf-8")

    blocks = re.findall(r"```mermaid\n.*?\n```", md_text, flags=re.DOTALL)
    if len(blocks) != len(SVG_DIAGRAMS):
        sys.exit(f"Diagram mismatch: {len(blocks)} mermaid blocks in the Markdown but "
                 f"{len(SVG_DIAGRAMS)} print figures defined.\n"
                 f"Add or remove an entry in SVG_DIAGRAMS so the PDF keeps every figure.")

    it = iter(SVG_DIAGRAMS)
    md_text = re.sub(r"```mermaid\n.*?\n```",
                     lambda _m: "\n\n@@FIG" + str(id(_m)) + "@@\n\n",
                     md_text, flags=re.DOTALL)
    # second pass: substitute placeholders in order
    placeholders = re.findall(r"@@FIG\d+@@", md_text)
    for ph, fn in zip(placeholders, it):
        md_text = md_text.replace(ph, fn(), 1)

    # `toc` is what makes the table of contents work in the PDF. Without it the
    # headings carry no `id`, so every `](#anchor)` link in the Markdown renders
    # as text that looks clickable and does nothing. Its slugify matches
    # GitHub's closely enough that the same anchors serve both renderings; the
    # check below proves it rather than assuming.
    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "codehilite", "attr_list", "md_in_html", "toc"],
        extension_configs={
            "codehilite": {"noclasses": True, "pygments_style": "friendly"},
            "toc": {"anchorlink": False, "permalink": False},
        },
    )

    ids = set(re.findall(r'<h[1-6][^>]*\sid="([^"]+)"', html_body))
    hrefs = set(re.findall(r'href="#([^"]+)"', html_body))
    dangling = sorted(hrefs - ids)
    if dangling:
        sys.exit("Table of contents links point at headings that do not exist:\n  "
                 + "\n  ".join(dangling)
                 + "\nFix the anchor in the Markdown, or the heading it targets.")
    print(f"  {len(hrefs)} internal links resolve to {len(ids)} heading anchors")

    cover = """
    <div class="cover">
      <h1>EventOS</h1>
      <div class="sub">Developer Handbook</div>
      <div class="meta">
        Derived from the repository at commit <code>eb056b3</code><br/>
        14 August 2026<br/><br/>
        Everything in this document was verified against the source.<br/>
        Anything that could not be verified is labelled as such.
      </div>
    </div>
    """

    html = (f'<!doctype html><html><head><meta charset="utf-8">'
            f"<style>{CSS}</style></head><body>{cover}{html_body}</body></html>")

    HTML(string=html, base_url=str(ROOT)).write_pdf(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB, "
          f"{len(blocks)} figures)")


if __name__ == "__main__":
    main()

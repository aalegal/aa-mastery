"""
Build the six review-protocol PDFs into ../protocols/.

    python3 -m venv .venv && .venv/bin/pip install reportlab
    .venv/bin/python tools/build_protocols.py

The words live in protocols_content.py; this file only lays them out.
Fonts come from macOS (Arial, Georgia). On another OS, point FONT_DIR at any
directory holding those TTFs, or swap in equivalents.
"""
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import protocols_content as C  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), "protocols")
FONT_DIR = "/System/Library/Fonts/Supplemental"

pdfmetrics.registerFont(TTFont("Body", os.path.join(FONT_DIR, "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Body-Bold", os.path.join(FONT_DIR, "Arial Bold.ttf")))
pdfmetrics.registerFont(TTFont("Title", os.path.join(FONT_DIR, "Georgia Bold.ttf")))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold",
                              italic="Body", boldItalic="Body-Bold")

NAVY = colors.HexColor("#14213d")
GOLD = colors.HexColor("#a8761a")
MUTED = colors.HexColor("#5b6474")
RULE = colors.HexColor("#d9dde4")
HEAD_BG = colors.HexColor("#eef1f5")
CALLOUT_BG = colors.HexColor("#fbf6ea")
ZEBRA = colors.HexColor("#f8f9fb")

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch
FRAME_W = PAGE_W - 2 * MARGIN

S = {
    "eyebrow": ParagraphStyle("eyebrow", fontName="Body-Bold", fontSize=8, leading=10,
                              textColor=GOLD, spaceAfter=6),
    "title": ParagraphStyle("title", fontName="Title", fontSize=21, leading=25,
                            textColor=NAVY, spaceAfter=4),
    "subtitle": ParagraphStyle("subtitle", fontName="Body", fontSize=11, leading=15,
                               textColor=MUTED, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName="Body-Bold", fontSize=12, leading=15,
                         textColor=NAVY, spaceBefore=12, spaceAfter=5, keepWithNext=1),
    "body": ParagraphStyle("body", fontName="Body", fontSize=9.5, leading=13.6,
                           textColor=colors.HexColor("#1d2330"), spaceAfter=6,
                           alignment=TA_LEFT),
    "bullet": ParagraphStyle("bullet", fontName="Body", fontSize=9.5, leading=13.6,
                             textColor=colors.HexColor("#1d2330"), leftIndent=12,
                             bulletIndent=2, spaceAfter=3),
    "cell": ParagraphStyle("cell", fontName="Body", fontSize=8.4, leading=11.2,
                           textColor=colors.HexColor("#1d2330")),
    "cellb": ParagraphStyle("cellb", fontName="Body-Bold", fontSize=8.4, leading=11.2,
                            textColor=NAVY),
    "cellh": ParagraphStyle("cellh", fontName="Body-Bold", fontSize=7.8, leading=10,
                            textColor=MUTED),
    "note": ParagraphStyle("note", fontName="Body", fontSize=8.6, leading=12,
                           textColor=MUTED, leftIndent=12, bulletIndent=2, spaceAfter=3),
    "callout_t": ParagraphStyle("callout_t", fontName="Body-Bold", fontSize=9.5,
                                leading=13, textColor=GOLD, spaceAfter=2),
    "callout": ParagraphStyle("callout", fontName="Body", fontSize=9.2, leading=13,
                              textColor=colors.HexColor("#1d2330")),
    "meta_k": ParagraphStyle("meta_k", fontName="Body-Bold", fontSize=7.6, leading=10,
                             textColor=MUTED),
    "meta_v": ParagraphStyle("meta_v", fontName="Body", fontSize=9, leading=12,
                             textColor=NAVY),
    "training": ParagraphStyle("training", fontName="Body", fontSize=8.2, leading=11,
                               textColor=MUTED),
}


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def P(text, style="body"):
    return Paragraph(esc(text), S[style])


def section(n, title):
    return Paragraph("%d&nbsp;&nbsp;%s" % (n, esc(title)), S["h2"])


def bullets(items, style="bullet"):
    out = []
    for t in items:
        if t.startswith("* "):
            out.append(Paragraph(esc(t[2:]), S[style], bulletText="*"))
        else:
            out.append(Paragraph(esc(t), S[style], bulletText="•"))
    return out


def table(head, rows, widths, bold_first=True):
    data = [[Paragraph(esc(h).upper(), S["cellh"]) for h in head]]
    for r in rows:
        data.append([Paragraph(esc(c), S["cellb" if (i == 0 and bold_first) else "cell"])
                     for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(2, len(data), 2):
        style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(style))
    return t


def callout(title, text):
    t = Table([[[Paragraph(esc(title), S["callout_t"]), Paragraph(esc(text), S["callout"])]]],
              colWidths=[FRAME_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CALLOUT_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def meta_row(meta):
    cells = [[Paragraph(esc(k).upper(), S["meta_k"]), Paragraph(esc(v), S["meta_v"])]
             for k, v in meta]
    widths = [FRAME_W * w for w in (0.22, 0.38, 0.40)][:len(cells)]
    t = Table([cells], colWidths=widths)
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


class NumberedCanvas(rl_canvas.Canvas):
    """Draws the footer after layout, so it can say 'Page 2 of 4'."""
    matter_short = ""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            self._footer(total)
            super().showPage()
        super().save()

    def _footer(self, total):
        y = MARGIN * 0.55
        self.setStrokeColor(RULE)
        self.setLineWidth(0.5)
        self.line(MARGIN, y + 11, PAGE_W - MARGIN, y + 11)
        self.setFont("Body", 7.4)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, y, "AA Team  ·  %s  ·  Training matter, fictional parties"
                        % self.matter_short)
        self.drawRightString(PAGE_W - MARGIN, y,
                             "Page %d of %d" % (self._pageNumber, total))


def build(m):
    story = [
        Paragraph("AA TEAM&nbsp;&nbsp;·&nbsp;&nbsp;DOCUMENT REVIEW PROTOCOL", S["eyebrow"]),
        Paragraph(esc(m["title"]), S["title"]),
        Paragraph(esc(m["subtitle"]), S["subtitle"]),
        meta_row(m["meta"]),
        Spacer(1, 6),
        P(C.TRAINING_NOTE, "training"),
    ]
    sc = m["scheme"]
    w = FRAME_W
    num = [0]

    def sect(title, *first, rest=()):
        """A heading bound to its first block, so it can never end a page alone."""
        num[0] += 1
        story.append(KeepTogether([section(num[0], title)] + list(first)))
        story.extend(rest)

    sect("Matter overview", *[P(t) for t in m["overview"]])

    sect("Parties and custodians",
         table(["Role", "Name"], m["custodians"], [w * 0.34, w * 0.66]))

    sect("Coding fields on %s" % m["platform"],
         P("These are the values the coding panel offers. Every document gets all "
           "five fields, and all five are graded."),
         table(["Field", "Values"], sc["fields"], [w * 0.26, w * 0.74]))

    sect("How to code",
         table(sc["head"], sc["rows"], [w * 0.29, w * 0.18, w * 0.17, w * 0.14, w * 0.22]),
         rest=[Spacer(1, 6)] + bullets(sc["notes"], "note"))

    if m.get("issue_head"):
        issues = table(m["issue_head"], m["issues"], [w * 0.06, w * 0.24, w * 0.22, w * 0.48])
    else:
        issues = table(["#", "Issue", "Definition", "What to look for"], m["issues"],
                       [w * 0.06, w * 0.22, w * 0.30, w * 0.42])
    if len(m["issues"]) > 8:
        # Too long to keep whole: bind the heading to the table's first rows by
        # letting the table split, with the header row repeating on each page.
        num[0] += 1
        story.extend([section(num[0], "Issue tags"), issues])
    else:
        sect("Issue tags", issues)

    sect("Attorney and law-firm screen",
         P("A name on this list does not make a document privileged. It tells you to "
           "read closely for legal advice."),
         table(["Name", "Role", "Firm / domain"], m["screen"], [w * 0.28, w * 0.38, w * 0.34]))

    priv = bullets(m["privilege"])
    sect("Privilege", *priv[:2], rest=priv[2:])

    sect("Confidentiality",
         table(["Designation", "Use it for"], sc["conf"], [w * 0.26, w * 0.74]),
         Spacer(1, 4), P(sc["conf_note"], "note"))

    if m.get("redaction"):
        red = bullets(m["redaction"])
        sect("Redaction", *red[:2], rest=red[2:])

    if m.get("alerts"):
        al = [callout(t, x) for t, x in m["alerts"]]
        rest = []
        for c in al[1:]:
            rest += [Spacer(1, 6), c]
        sect("Matter alerts", al[0], rest=rest)

    # The closing section moves as one unit: a lone QC table on an otherwise
    # empty last page reads as a mistake.
    sect("Escalation and the QC standard",
         table(["Step", "Who", "When"], C.ESCALATION, [w * 0.08, w * 0.24, w * 0.68]),
         Spacer(1, 6), *bullets(C.ESCALATION_NOTES, "note"),
         Spacer(1, 6), table(["QC Track standard", ""], C.QC_STANDARD, [w * 0.30, w * 0.70]))

    path = os.path.join(OUT, m["file"])

    class _Canvas(NumberedCanvas):
        matter_short = m["short"]

    doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=MARGIN, bottomMargin=MARGIN,
                            title="%s — Review Protocol" % m["title"],
                            author="AA Team", subject="Document review protocol",
                            creator="AA Team Mastery Hub")
    doc.build(story, canvasmaker=_Canvas)
    return path


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for m in C.MATTERS:
        print(build(m))

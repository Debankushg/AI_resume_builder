from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer
from xml.sax.saxutils import escape

from app.schemas.resume import ResumeData


def build_pdf(r: ResumeData) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm, title=r.name or "Resume",
    )
    base = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=base["Title"], fontSize=24, alignment=0, spaceAfter=2)
    contact = ParagraphStyle("c", parent=base["Normal"], textColor=colors.HexColor("#555555"))
    h = ParagraphStyle("h", parent=base["Heading2"], textColor=colors.HexColor("#1d4ed8"),
                       spaceBefore=10, spaceAfter=2)
    body = base["BodyText"]
    bold = ParagraphStyle("b", parent=body, fontName="Helvetica-Bold", spaceAfter=0)
    sub = ParagraphStyle("s", parent=body, textColor=colors.HexColor("#666666"), spaceAfter=1)

    e = escape
    s = [Paragraph(e(r.name or "Your Name"), title)]
    info = " | ".join(x for x in [r.email, r.phone, r.location] if x)
    if info:
        s.append(Paragraph(e(info), contact))

    def section(name):
        s.append(Paragraph(name, h))
        s.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cbd5e1")))
        s.append(Spacer(1, 3))

    if r.summary:
        section("Summary")
        s.append(Paragraph(e(r.summary), body))
    if r.skills:
        section("Skills")
        s.append(Paragraph(e(", ".join(r.skills)), body))
    if r.experience:
        section("Experience")
        for x in r.experience:
            s.append(Paragraph(e(f"{x.role} — {x.company}"), bold))
            dates = " - ".join(d for d in [x.start_date, x.end_date] if d)
            if dates:
                s.append(Paragraph(e(dates), sub))
            if x.description:
                s.append(Paragraph(e(x.description), body))
    if r.projects:
        section("Projects")
        for p in r.projects:
            s.append(Paragraph(e(p.name), bold))
            if p.technologies:
                s.append(Paragraph(e("Tech: " + ", ".join(p.technologies)), sub))
            if p.description:
                s.append(Paragraph(e(p.description), body))
            if p.link:
                s.append(Paragraph(e(p.link), sub))
    if r.education:
        section("Education")
        for x in r.education:
            s.append(Paragraph(e(f"{x.degree} — {x.institution}"), bold))
            years = " - ".join(d for d in [x.start_year, x.end_year] if d)
            if years:
                s.append(Paragraph(e(years), sub))

    doc.build(s)
    return buf.getvalue()

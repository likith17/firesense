#!/usr/bin/env python3
"""Build FireSense Space Apps submission deck as PowerPoint (.pptx)."""

from __future__ import annotations

import shutil
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import nsmap
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUT_DOCS = ROOT / "docs" / "FireSense-slides.pptx"
OUT_DIST = ROOT / "dist" / "FireSense-slides.pptx"

# Dark earthy atlas palette (matches docs/slides.html)
BG = RGBColor(0x10, 0x18, 0x16)
PANEL = RGBColor(0x18, 0x23, 0x1F)
LINE = RGBColor(0x33, 0x41, 0x39)
TEXT = RGBColor(0xEA, 0xF0, 0xE8)
MUTED = RGBColor(0xA2, 0xB1, 0xA4)
ORANGE = RGBColor(0xFF, 0xAC, 0x62)
MINT = RGBColor(0xC5, 0xE4, 0xA5)
DEEP = RGBColor(0x0B, 0x12, 0x10)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def _set_run_font(run, *, size_pt, bold=False, color=TEXT, name="Calibri"):
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = name


def _solid_fill(shape, color: RGBColor):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def _panel_fill(shape, color: RGBColor = PANEL, line_color: RGBColor = LINE):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.color.rgb = line_color
    shape.line.width = Pt(1)


def _add_bg(slide):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    _solid_fill(shape, BG)
    # Soft mint wash (top-left)
    wash = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(-1.2), Inches(-1.8), Inches(6.5), Inches(4.2)
    )
    wash.fill.solid()
    wash.fill.fore_color.rgb = RGBColor(0x1A, 0x2A, 0x22)
    wash.line.fill.background()
    # Soft orange wash (bottom-right)
    wash2 = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(9.0), Inches(4.8), Inches(5.5), Inches(3.8)
    )
    wash2.fill.solid()
    wash2.fill.fore_color.rgb = RGBColor(0x1C, 0x1A, 0x14)
    wash2.line.fill.background()
    # Frame
    frame = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.28),
        Inches(0.28),
        SLIDE_W - Inches(0.56),
        SLIDE_H - Inches(0.56),
    )
    frame.fill.background()
    frame.line.color.rgb = LINE
    frame.line.width = Pt(1.25)
    try:
        frame.adjustments[0] = 0.04
    except Exception:
        pass


def _textbox(slide, left, top, width, height):
    return slide.shapes.add_textbox(left, top, width, height)


def _para(tf, text, *, size=20, bold=False, color=TEXT, align=PP_ALIGN.LEFT, space_before=0, space_after=6, name="Calibri"):
    p = tf.paragraphs[0] if not tf.paragraphs[0].text and len(tf.paragraphs) == 1 and tf.text == "" else tf.add_paragraph()
    if tf.text == "" and len(tf.paragraphs) == 1:
        p = tf.paragraphs[0]
    else:
        # If first para already used, add_paragraph was called above incorrectly when empty
        pass
    # Simpler: always clear-and-build via helper that returns a new paragraph
    return None  # unused; see add_paragraph_text


def add_paragraph_text(
    tf,
    text,
    *,
    size=20,
    bold=False,
    color=TEXT,
    align=PP_ALIGN.LEFT,
    space_before=0,
    space_after=8,
    name="Calibri",
    first=False,
):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    run = p.add_run()
    run.text = text
    _set_run_font(run, size_pt=size, bold=bold, color=color, name=name)
    return p


def add_mixed_paragraph(
    tf,
    parts,
    *,
    size=20,
    align=PP_ALIGN.LEFT,
    space_before=0,
    space_after=8,
    first=False,
    bullet=False,
):
    """parts: list of (text, bold, color)"""
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    if bullet:
        pPr = p._p.get_or_add_pPr()
        buFont = OxmlElement("a:buFont")
        buFont.set("typeface", "Arial")
        buChar = OxmlElement("a:buChar")
        buChar.set("char", "•")
        # Remove existing bullet nodes if any
        for child in list(pPr):
            if child.tag.endswith("buFont") or child.tag.endswith("buChar") or child.tag.endswith("buNone"):
                pPr.remove(child)
        pPr.append(buFont)
        pPr.append(buChar)
    for text, bold, color in parts:
        run = p.add_run()
        run.text = text
        _set_run_font(run, size_pt=size, bold=bold, color=color)
    return p


def kicker_title(slide, kicker, title, *, title_size=36):
    box = _textbox(slide, Inches(0.7), Inches(0.55), Inches(11.8), Inches(0.4))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, kicker.upper(), size=13, bold=True, color=MINT, space_after=0, first=True, name="Calibri")

    box2 = _textbox(slide, Inches(0.7), Inches(0.95), Inches(11.8), Inches(1.35))
    tf2 = box2.text_frame
    tf2.word_wrap = True
    add_paragraph_text(
        tf2,
        title,
        size=title_size,
        bold=False,
        color=TEXT,
        space_after=0,
        first=True,
        name="Georgia",
    )
    return box2


def footer(slide, n, total=10):
    box = _textbox(slide, Inches(0.7), Inches(7.05), Inches(8), Inches(0.3))
    tf = box.text_frame
    add_paragraph_text(tf, f"FireSense  ·  Space Apps 2026  ·  {n}/{total}", size=11, color=MUTED, space_after=0, first=True)


def bullet_block(slide, left, top, width, height, items, *, size=20):
    """items: list of str or list of parts tuples for mixed"""
    box = _textbox(slide, left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if isinstance(item, str):
            add_mixed_paragraph(
                tf,
                [("•  ", False, ORANGE), (item, False, TEXT)],
                size=size,
                space_after=10,
                first=(i == 0),
            )
        else:
            # item is list of (text, bold, color) without bullet - prepend bullet
            parts = [("•  ", False, ORANGE)] + list(item)
            add_mixed_paragraph(tf, parts, size=size, space_after=10, first=(i == 0))
    return box


def analogy_box(slide, left, top, width, height, text):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    _panel_fill(shape, PANEL, LINE)
    try:
        shape.adjustments[0] = 0.08
    except Exception:
        pass
    # mint accent bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, Inches(0.08), height)
    _solid_fill(bar, MINT)
    box = _textbox(slide, left + Inches(0.22), top + Inches(0.12), width - Inches(0.35), height - Inches(0.2))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, text, size=15, color=MUTED, space_after=0, first=True)


def stat_card(slide, left, top, width, height, label, value, note):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    _panel_fill(shape, PANEL, LINE)
    try:
        shape.adjustments[0] = 0.1
    except Exception:
        pass
    box = _textbox(slide, left + Inches(0.18), top + Inches(0.18), width - Inches(0.36), height - Inches(0.3))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, label.upper(), size=11, bold=True, color=MUTED, space_after=4, first=True)
    add_paragraph_text(tf, value, size=32, bold=False, color=ORANGE, space_after=6, name="Georgia")
    add_paragraph_text(tf, note, size=13, color=MUTED, space_after=0)


def card_block(slide, left, top, width, height, heading, lines):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    _panel_fill(shape, PANEL, LINE)
    try:
        shape.adjustments[0] = 0.08
    except Exception:
        pass
    box = _textbox(slide, left + Inches(0.22), top + Inches(0.2), width - Inches(0.4), height - Inches(0.35))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, heading, size=22, bold=False, color=ORANGE, space_after=10, first=True, name="Georgia")
    for line in lines:
        add_mixed_paragraph(
            tf,
            [("•  ", False, ORANGE), (line, False, MUTED)],
            size=15,
            space_after=8,
        )


def new_slide(prs):
    blank = prs.slide_layouts[6]  # blank
    slide = prs.slides.add_slide(blank)
    _add_bg(slide)
    return slide


def build():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    # --- 1 Title ---
    s = new_slide(prs)
    box = _textbox(s, Inches(0.7), Inches(1.35), Inches(11.8), Inches(0.4))
    add_paragraph_text(box.text_frame, "NASA SPACE APPS CHALLENGE 2026", size=14, bold=True, color=MINT, space_after=0, first=True)
    box = _textbox(s, Inches(0.7), Inches(1.85), Inches(11.8), Inches(1.2))
    add_paragraph_text(box.text_frame, "FireSense", size=60, color=TEXT, space_after=0, first=True, name="Georgia")
    box = _textbox(s, Inches(0.7), Inches(3.15), Inches(10.5), Inches(1.1))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(
        tf,
        "A burning-activity calendar that helps anyone explore MODIS and VIIRS hotspot observations - clearly, honestly, and side by side.",
        size=20,
        color=MUTED,
        space_after=0,
        first=True,
    )
    # badges
    for i, label in enumerate(["Challenge: MODIS & VIIRS Hot Spots", "Team: Likith Podalakuru (solo)"]):
        left = Inches(0.7) + Inches(i * 4.4)
        badge = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(4.5), Inches(4.1), Inches(0.42))
        _panel_fill(badge, DEEP, LINE)
        try:
            badge.adjustments[0] = 0.5
        except Exception:
            pass
        tb = _textbox(s, left + Inches(0.15), Inches(4.55), Inches(3.8), Inches(0.32))
        add_paragraph_text(tb.text_frame, label.upper(), size=11, bold=True, color=MINT, space_after=0, first=True)
    box = _textbox(s, Inches(0.7), Inches(5.2), Inches(11), Inches(1.0))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, "Likith Podalakuru  ·  NASA Space Apps 2026", size=16, color=TEXT, space_after=4, first=True)
    add_paragraph_text(tf, "github.com/likith17/firesense", size=15, color=MINT, space_after=2)
    add_paragraph_text(tf, "likith17.github.io/firesense/", size=15, color=MINT, space_after=0)
    footer(s, 1)

    # --- 2 Problem ---
    s = new_slide(prs)
    kicker_title(s, "The problem", "Satellites see heat. People need a clear story.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.5),
        Inches(11.5),
        Inches(3.0),
        [
            [
                ("NASA FIRMS publishes millions of ", False, TEXT),
                ("hotspot detections", True, MINT),
                (" from Earth-observing satellites.", False, TEXT),
            ],
            [
                ('Those points are not the same as "this many unique fires" - one fire can light up many detections.', False, TEXT),
            ],
            [
                ("Different sensors and product versions arrive in different shapes, so comparing them by hand is hard.", False, TEXT),
            ],
            [
                ("Beginners need a calm map and calendar - not a raw CSV dump.", False, TEXT),
            ],
        ],
        size=18,
    )
    analogy_box(
        s,
        Inches(0.7),
        Inches(5.55),
        Inches(11.8),
        Inches(1.15),
        "Think of smoke alarms city-wide: many alarms can ring for one event. Counting alarms is useful - but it is not the same as counting fires.",
    )
    footer(s, 2)

    # --- 3 What it is ---
    s = new_slide(prs)
    kicker_title(s, "What FireSense is", "An atlas of detections you can actually browse.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.5),
        Inches(7.2),
        Inches(3.6),
        [
            "Interactive map of daily one-degree cells with source attribution kept intact.",
            'Monthly calendar: raw counts, or "vs a typical month" using the median of the same calendar month in other selected years.',
            "Filters for product, processing class, area, dates, and confidence.",
            "CSV and provenance exports so every view can be traced.",
        ],
        size=16,
    )
    stat_card(s, Inches(8.3), Inches(2.5), Inches(4.2), Inches(1.7), "Full atlas", "~28.8M", "observations after careful deduplication")
    stat_card(s, Inches(8.3), Inches(4.45), Inches(4.2), Inches(1.7), "Public demo", "4 presets", "real snapshots - Global 2026, California, Northwest, Southeast")
    footer(s, 3)

    # --- 4 Two eyes ---
    s = new_slide(prs)
    kicker_title(s, "Two satellite eyes", "MODIS and VIIRS see the same Earth differently.")
    card_block(
        s,
        Inches(0.7),
        Inches(2.5),
        Inches(5.7),
        Inches(2.9),
        "MODIS - Terra & Aqua",
        [
            "Long heritage record (U.S. from late 2000 in this atlas).",
            "Coarser footprint than modern VIIRS fire products.",
            "Useful for long calendars and continuity.",
        ],
    )
    card_block(
        s,
        Inches(6.8),
        Inches(2.5),
        Inches(5.7),
        Inches(2.9),
        "VIIRS - Suomi NPP",
        [
            "Finer nighttime fire detection than MODIS.",
            "Imported here from 2012 onward (U.S.-consistent extent historically).",
            "NOAA-20 / NOAA-21 are not imported yet.",
        ],
    )
    analogy_box(
        s,
        Inches(0.7),
        Inches(5.6),
        Inches(11.8),
        Inches(1.1),
        "Two cameras on the same street: both are true, but they do not frame every scene the same way. FireSense keeps both labels visible.",
    )
    footer(s, 4)

    # --- 5 Archive vs NRT ---
    s = new_slide(prs)
    kicker_title(s, "Standard vs near real-time", "Fast news and the library stay on separate shelves.")
    # cards with paragraph body
    for left, heading, body in [
        (
            Inches(0.7),
            "Standard archive",
            "Reviewed / reprocessed products meant for careful historical study. Prefer this when you want a stable calendar.",
        ),
        (
            Inches(6.8),
            "Near Real-Time (NRT)",
            "Provisional, faster feeds. Useful for recent activity - not mixed silently into the archive.",
        ),
    ]:
        shape = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(2.5), Inches(5.7), Inches(2.0))
        _panel_fill(shape, PANEL, LINE)
        try:
            shape.adjustments[0] = 0.08
        except Exception:
            pass
        box = _textbox(s, left + Inches(0.22), Inches(2.7), Inches(5.25), Inches(1.65))
        tf = box.text_frame
        tf.word_wrap = True
        add_paragraph_text(tf, heading, size=22, color=ORANGE, space_after=10, first=True, name="Georgia")
        add_paragraph_text(tf, body, size=15, color=MUTED, space_after=0)
    bullet_block(
        s,
        Inches(0.7),
        Inches(4.75),
        Inches(11.8),
        Inches(1.6),
        [
            [
                ("FireSense ", False, TEXT),
                ("keeps Standard and NRT separate", True, MINT),
                (" so a quick update never quietly rewrites history.", False, TEXT),
            ],
            [
                ("Overlapping identical records are deduplicated; conflicting identities abort instead of guessing.", False, TEXT),
            ],
        ],
        size=17,
    )
    footer(s, 5)

    # --- 6 Exploring ---
    s = new_slide(prs)
    kicker_title(s, "Exploring the atlas", "Map + calendar = place and season in one view.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.5),
        Inches(11.5),
        Inches(3.2),
        [
            [("Map: ", True, MINT), ("where detections cluster inside your selection.", False, TEXT)],
            [("Calendar: ", True, MINT), ("how busy each month looks across years.", False, TEXT)],
            [("Typical-month mode: ", True, MINT), ("compare a month to the median of that same month in the other years you selected.", False, TEXT)],
            [("Seasonal profile: ", True, MINT), ("a simple year-shape of activity for the selection.", False, TEXT)],
            "Demo starters: Global 2026, California history, Pacific Northwest, Southeastern U.S.",
        ],
        size=17,
    )
    analogy_box(
        s,
        Inches(0.7),
        Inches(5.7),
        Inches(11.8),
        Inches(1.0),
        "Like a photo album with a date stamp: flip by place on the map, flip by month on the calendar.",
    )
    footer(s, 6)

    # --- 7 California ---
    s = new_slide(prs)
    kicker_title(
        s,
        "A story from the calendar",
        "California, January 2025 - almost 4× a typical January.",
        title_size=32,
    )
    w = Inches(3.7)
    gap = Inches(0.25)
    start = Inches(0.7)
    stats = [
        ("January 2025", "3,994", "detections in the selection"),
        ("Typical January", "~1,036.5", "median of other selected years"),
        ("How unusual?", "~4×", "vs that typical January - not an average"),
    ]
    for i, (lab, val, note) in enumerate(stats):
        stat_card(s, start + i * (w + gap), Inches(2.55), w, Inches(2.0), lab, val, note)
    bullet_block(
        s,
        Inches(0.7),
        Inches(4.85),
        Inches(11.8),
        Inches(1.6),
        [
            [
                ("This is a ", False, TEXT),
                ("descriptive", True, MINT),
                (" view inside the selection - not a cloud-corrected anomaly product.", False, TEXT),
            ],
            [
                ('It helps a non-expert ask better questions: "Was this January unusually busy in the record we selected?"', False, TEXT),
            ],
        ],
        size=16,
    )
    footer(s, 7)

    # --- 8 Compare ---
    s = new_slide(prs)
    kicker_title(s, "Cross-sensor evidence", "Compare the two eyes. Do not pretend they are one.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.5),
        Inches(11.5),
        Inches(3.2),
        [
            "FireSense shows MODIS and VIIRS counts with proportional bars - side by side.",
            [
                ("Confidence rules differ (for example MODIS ≥30 vs VIIRS nominal/high). They are ", False, TEXT),
                ("not", True, MINT),
                (" the same probability scale.", False, TEXT),
            ],
            [
                ("Goal: honest co-viewing for exploration and education - ", False, TEXT),
                ("not sensor fusion", True, MINT),
                (".", False, TEXT),
            ],
            "When numbers disagree, that disagreement is information, not a bug to hide.",
        ],
        size=17,
    )
    analogy_box(
        s,
        Inches(0.7),
        Inches(5.7),
        Inches(11.8),
        Inches(1.0),
        "Two witnesses. Listen to both. Do not average their stories into a fake third voice.",
    )
    footer(s, 8)

    # --- 9 Evaluation ---
    s = new_slide(prs)
    kicker_title(s, "Held-out scientific check", "We studied for the test - then took a sealed exam.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.45),
        Inches(7.0),
        Inches(3.0),
        [
            [("Train ", True, MINT), ("2013-2021 → fit candidates.", False, TEXT)],
            [("Select ", True, MINT), ("on 2022 → pick the mapping.", False, TEXT)],
            [("Calibrate ", True, MINT), ("interval on 2023.", False, TEXT)],
            [("Test once ", True, MINT), ("on 2024-2025.", False, TEXT)],
            "Three U.S. boxes only · 72 region-months · experimental.",
        ],
        size=17,
    )
    stat_card(s, Inches(8.1), Inches(2.45), Inches(4.4), Inches(1.7), "Log-linear MAE", "~960", "12.9% better than a fitted ratio baseline")
    stat_card(s, Inches(8.1), Inches(4.35), Inches(4.4), Inches(1.7), "Interval coverage", "90.3%", "empirical on the held-out pairs")
    analogy_box(
        s,
        Inches(0.7),
        Inches(5.75),
        Inches(11.8),
        Inches(0.95),
        "School test: practice years, a quiz to choose the method, then a final exam you only open once. This is not a forecast and not fusion.",
    )
    footer(s, 9)

    # --- 10 Limits & links ---
    s = new_slide(prs)
    kicker_title(s, "Honesty + try it", "What we do not claim - and where to look.")
    bullet_block(
        s,
        Inches(0.7),
        Inches(2.45),
        Inches(7.0),
        Inches(3.6),
        [
            "Not unique fires, burned area, or fire-type labels.",
            "No cloud / overpass correction or operational early warning.",
            "Grid cells are equal in degrees, not equal ground area.",
            "Pre-2026 global coverage is incomplete; NOAA-20/21 not imported.",
            "Held-out mapping is experimental, regional, and not a forecast.",
        ],
        size=16,
    )
    shape = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.0), Inches(2.45), Inches(4.5), Inches(3.5))
    _panel_fill(shape, PANEL, LINE)
    try:
        shape.adjustments[0] = 0.08
    except Exception:
        pass
    box = _textbox(s, Inches(8.22), Inches(2.65), Inches(4.1), Inches(3.15))
    tf = box.text_frame
    tf.word_wrap = True
    add_paragraph_text(tf, "Open FireSense", size=22, color=ORANGE, space_after=14, first=True, name="Georgia")
    add_paragraph_text(tf, "likith17.github.io/firesense/", size=14, color=MINT, space_after=10)
    add_paragraph_text(tf, "github.com/likith17/firesense", size=14, color=MINT, space_after=16)
    add_paragraph_text(tf, "Team: Likith Podalakuru (solo)", size=13, color=MUTED, space_after=6)
    add_paragraph_text(tf, "Challenge: MODIS and VIIRS Hot Spots", size=13, color=MUTED, space_after=0)
    footer(s, 10)

    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    OUT_DIST.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT_DOCS)
    shutil.copy2(OUT_DOCS, OUT_DIST)
    return OUT_DOCS, OUT_DIST, len(prs.slides)


def verify(path: Path):
    from pptx import Presentation as P

    prs = P(path)
    n = len(prs.slides)
    size = path.stat().st_size
    # unzip check
    import zipfile

    with zipfile.ZipFile(path, "r") as zf:
        names = zf.namelist()
        slide_xml = [x for x in names if x.startswith("ppt/slides/slide") and x.endswith(".xml")]
    return {
        "path": str(path),
        "bytes": size,
        "slides_api": n,
        "slide_xml_count": len(slide_xml),
        "sample_entries": slide_xml[:3],
    }


if __name__ == "__main__":
    docs, dist, count = build()
    info = verify(docs)
    print(f"Wrote {docs}")
    print(f"Copied {dist}")
    print(f"Slide count: {count}")
    print(f"Verify: {info}")

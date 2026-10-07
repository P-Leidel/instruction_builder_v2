"""Reopen all A3 vector pages and compare actual PNG glyph/symbol ink."""
import json
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from pypdf import PdfReader

directory = Path(__file__).resolve().parent
plan = json.loads((directory / "plan.json").read_text(encoding="utf8"))
reader = PdfReader(directory / "continuation-a3.pdf")
assert len(reader.pages) == len(plan["pages"])
pdf_images = sorted(directory.glob("continuation-a3-pdf-independent-*.png"))
assert len(pdf_images) == len(plan["pages"])
seen = set()
def no_images(resources):
    for reference in (resources.get("/XObject", {}) or {}).values():
        value = reference.get_object()
        key = (getattr(reference, "idnum", None), getattr(reference, "generation", None))
        if key in seen:
            continue
        seen.add(key)
        assert value.get("/Subtype") != "/Image", "PDF has an image XObject"
        if value.get("/Resources"):
            no_images(value["/Resources"])

records = []
gallery = Image.new("RGB", (1530, len(plan["pages"]) * 760), "#e2e8f0")
scale = 150 / 25.4
for index, page in enumerate(plan["pages"]):
    pdf_page = reader.pages[index]
    no_images(pdf_page.get("/Resources", {}))
    actual_mm = [float(pdf_page.mediabox.width) * 25.4 / 72, float(pdf_page.mediabox.height) * 25.4 / 72]
    assert max(abs(a - b) for a, b in zip(actual_mm, [297, 420])) < .001
    stem = f"continuation-a3-page-{index + 1:02d}"
    paths = [directory / f"{stem}.png", directory / f"{stem}-svg-independent.png", pdf_images[index]]
    images = []
    for image_path in paths:
        with Image.open(image_path) as original:
            background = Image.new("RGBA", original.size, "white")
            background.alpha_composite(original.convert("RGBA"))
            images.append(background.convert("RGB"))
    expected_pixels = [round(297 * scale), round(420 * scale)]
    dimensions = [image.size for image in images]
    assert list(images[0].size) == expected_pixels
    for image in images:
        assert max(abs(a - b) for a, b in zip(image.size, expected_pixels)) <= 1
    fragments = []
    for fragment in page["fragments"]:
        if fragment["kind"] == "connector":
            continue
        box = fragment["box"]
        area = (math.floor(box["xMm"] * scale), math.floor(box["yMm"] * scale), math.ceil((box["xMm"] + box["widthMm"]) * scale), math.ceil((box["yMm"] + box["heightMm"]) * scale))
        masks = [image.crop(area).convert("L").point(lambda pixel: 255 if pixel < 180 else 0) for image in images]
        bounds = [mask.getbbox() for mask in masks]
        assert all(value is not None for value in bounds), f"Missing ink: {fragment}"
        edge_delta = max(max(abs(a - b) for a, b in zip(bounds[0], value)) for value in bounds)
        assert edge_delta <= 2, f"Ink edge drift: {fragment} {bounds}"
        unmatched = []
        for other in masks[1:]:
            for reference, candidate in [(masks[0], other), (other, masks[0])]:
                missing = ImageChops.subtract(reference, candidate.filter(ImageFilter.MaxFilter(5))).histogram()[255]
                ink = reference.histogram()[255]
                ratio = missing / ink
                assert ratio <= .03, f"Ink shape drift: {fragment} {ratio}"
                unmatched.append(ratio)
        fragments.append({"kind": fragment["kind"], "role": fragment["role"], "source": fragment["source"], "text": fragment.get("text"), "inkBounds": bounds, "maximumEdgeDeltaPixels": edge_delta, "maximumUnmatchedInkRatioWithin2Pixels": max(unmatched)})
    for column, (name, image) in enumerate(zip(["actual PNG", "SVG / Sharp", "PDF / Poppler"], images)):
        image.thumbnail((500, 710))
        panel = Image.new("RGB", (510, 760), "white")
        ImageDraw.Draw(panel).text((8, 8), f"Page {index + 1} - {name}", fill="black")
        panel.paste(image, (5, 35))
        gallery.paste(panel, (column * 510, index * 760))
    records.append({"page": index + 1, "sizeMm": actual_mm, "pixelDimensions": dimensions, "fragments": fragments})
gallery.save(directory / "inspection-gallery.png")
result = {"status": "PASS", "dpi": 150, "mainPictures": sum(f["role"] == "token" and f["kind"] == "symbol" for p in records for f in p["fragments"]), "pages": records, "pdfImageXObjects": 0, "physicalAndParticipantAcceptance": "Pending"}
(directory / "independent-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
print(json.dumps({"status": "PASS", "pages": len(records), "checkedFragments": sum(len(p["fragments"]) for p in records), "mainPictures": result["mainPictures"]}))

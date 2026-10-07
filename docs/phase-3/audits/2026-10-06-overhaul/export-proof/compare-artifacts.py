"""Compare actual PNG against independently reopened vector SVG/PDF pages."""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from pypdf import PdfReader

directory = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
plans = json.loads((directory / "artifact-plans.json").read_text(encoding="utf-8"))
comparisons = []
panels = []
scale = 150 / 25.4
for name, plan in plans.items():
    pdf = PdfReader(directory / f"{name}.pdf")
    assert len(pdf.pages) == len(plan["pages"]), f"{name}: complete PDF page count"
    for index, page in enumerate(plan["pages"]):
        assert abs(float(pdf.pages[index].mediabox.width) * 25.4 / 72 - page["size"]["widthMm"]) < 0.001
        assert abs(float(pdf.pages[index].mediabox.height) * 25.4 / 72 - page["size"]["heightMm"]) < 0.001
        stem = f"{name}-page-{index + 1:02d}"
        pdf_file = sorted(directory.glob(f"{name}-pdf-*.png"))[index]
        pictures = {
            "png": Image.open(directory / f"{stem}.png"),
            "svg-independent": Image.open(directory / f"{stem}-independent.png"),
            "pdf-independent": Image.open(pdf_file),
        }
        # Transparent pages are compared on the same white viewing surface.
        images = {}
        for renderer, picture in pictures.items():
            background = Image.new("RGBA", picture.size, "white")
            background.alpha_composite(picture.convert("RGBA"))
            images[renderer] = background.convert("RGB")
        checks = []
        for fragment in page["fragments"]:
            if fragment["kind"] != "text" or not fragment["text"].strip():
                continue
            box = fragment["box"]
            area = (math.floor(box["xMm"] * scale), math.floor(box["yMm"] * scale), math.ceil((box["xMm"] + box["widthMm"]) * scale), math.ceil((box["yMm"] + box["heightMm"]) * scale))
            bounds = {renderer: image.crop(area).convert("L").point(lambda pixel: 255 if pixel < 180 else 0).getbbox() for renderer, image in images.items()}
            reference = bounds["png"]
            assert reference is not None and all(value is not None for value in bounds.values()), f"{name}: missing text {fragment['text']!r} {bounds}"
            delta = max(max(abs(a - b) for a, b in zip(reference, value)) for value in bounds.values())
            assert delta <= 2, f"{name}: changed glyph bounds {fragment['text']!r} {bounds}"
            checks.append({"text": fragment["text"], "role": fragment["role"], "source": fragment["source"], "inkBounds": bounds, "maximumEdgeDeltaPixels": delta})
        comparisons.append({"fixture": name, "page": index + 1, "pageSizeMm": page["size"], "pdfSizeVerified": True, "dimensions": {renderer: image.size for renderer, image in images.items()}, "textChecks": checks})
        if index == 0 and name in ["workplace", "routine", "required-detailed", "continuation"]:
            for renderer, image in images.items():
                image = image.crop((0, 0, image.width, min(image.height, 900)))
                image.thumbnail((480, 380))
                panel = Image.new("RGB", (500, 410), "white")
                ImageDraw.Draw(panel).text((8, 5), f"{name}: {renderer}", fill="black")
                panel.paste(image, (8, 24)); panels.append(panel)
montage = Image.new("RGB", (1500, math.ceil(len(panels) / 3) * 410), "#e2e8f0")
for index, panel in enumerate(panels):
    montage.paste(panel, ((index % 3) * 500, (index // 3) * 410))
montage.save(directory / "artifact-render-comparison.png")
(directory / "artifact-render-comparison.json").write_text(json.dumps({"dpi": 150, "maximumAllowedEdgeDeltaPixels": 2, "comparisons": comparisons}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"result": "PASS", "pages": len(comparisons), "textLines": sum(len(record["textChecks"]) for record in comparisons), "maximumEdgeDeltaPixels": 2}))

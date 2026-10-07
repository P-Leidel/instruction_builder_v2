"""Compare independently rendered text extents at 150 dpi; retain visual evidence."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parent
proof = json.loads((directory / "proof-results.json").read_text(encoding="utf-8"))
renderers = ["image", "browser", "independent", "pdf"]
comparisons = []
panels = []
scale = 150 / 25.4
for artifact in proof["artifacts"]:
    name = artifact["name"]
    images = {renderer: Image.open(directory / f"{name}-{renderer}.png").convert("RGB") for renderer in renderers}
    line_checks = []
    for line in artifact["painted"]:
        box = line["box"]
        area = (math.floor(box["xMm"] * scale), math.floor(box["yMm"] * scale), math.ceil((box["xMm"] + box["widthMm"]) * scale), math.ceil((box["yMm"] + box["heightMm"]) * scale))
        bounds = {}
        for renderer, picture in images.items():
            ink = picture.crop(area).convert("L").point(lambda pixel: 255 if pixel < 180 else 0)
            bounds[renderer] = ink.getbbox()
        reference = bounds["image"]
        max_delta = max((max(abs(a - b) for a, b in zip(reference, value)) for value in bounds.values() if value is not None), default=0)
        if reference is None or any(value is None for value in bounds.values()) or max_delta > 2:
            raise AssertionError(f"Missing/misaligned line {name}: {line['text']!r}: {bounds}")
        line_checks.append({"text": line["text"], "cropPixels": area, "inkBounds": bounds, "maximumEdgeDeltaPixels": max_delta})
    comparisons.append({"artifact": name, "dimensions": {renderer: image.size for renderer, image in images.items()}, "lines": line_checks})
    # Comparison panels preserve the diagnostic right/bottom boundary and the
    # composition's complete content region while avoiding a large blank tail.
    for renderer in renderers:
        image = images[renderer]
        if name == "composition":
            image = image.crop((0, 0, image.width, 820))
        image.thumbnail((560, 440))
        panel = Image.new("RGB", (580, 470), "white")
        ImageDraw.Draw(panel).text((10, 5), f"{name}: {renderer}", fill="black")
        panel.paste(image, (10, 25))
        panels.append(panel)
montage = Image.new("RGB", (4 * 580, 2 * 470), "#e2e8f0")
for index, panel in enumerate(panels):
    montage.paste(panel, ((index % 4) * 580, (index // 4) * 470))
montage.save(directory / "rendered-comparison.png")
(directory / "rendered-comparison.json").write_text(json.dumps({"dpi": 150, "threshold": 180, "maximumAllowedEdgeDeltaPixels": 2, "comparisons": comparisons}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"comparedArtifacts": len(comparisons), "comparedLines": sum(len(item["lines"]) for item in comparisons), "allEdgeDeltasAtMostPixels": 2}))

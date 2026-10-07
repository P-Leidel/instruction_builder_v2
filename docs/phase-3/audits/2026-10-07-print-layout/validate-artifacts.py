from pathlib import Path
import json
import os
import subprocess
from PIL import Image
from pypdf import PdfReader

directory = Path(__file__).resolve().parent
runtime = Path(os.environ.get("CODEX_PROOF_RUNTIME", "C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies"))
subprocess.run([str(runtime / "native/poppler/Library/bin/pdftoppm.exe"), "-png", "-r", "150", "-singlefile", str(directory / "banana-layout.pdf"), str(directory / "pdf-independent")], check=True)
script = """
const {createRequire}=require('node:module');
const path=require('node:path');
const sharp=createRequire(path.join(process.argv[1],'node/package.json'))('sharp');
sharp(process.argv[2],{density:150}).resize(1240,1754).png().toFile(process.argv[3]).catch(e=>{console.error(e);process.exitCode=1});
"""
subprocess.run([str(runtime / "node/bin/node.exe"), "-e", script, str(runtime), str(directory / "banana-layout.svg"), str(directory / "svg-independent.png")], check=True)
pdf = PdfReader(directory / "banana-layout.pdf")
assert len(pdf.pages) == 1
page = pdf.pages[0]
assert abs(float(page.mediabox.width) * 25.4 / 72 - 210) < .01
assert abs(float(page.mediabox.height) * 25.4 / 72 - 297) < .01
objects = page.get("/Resources", {}).get("/XObject", {})
assert all(item.get_object().get("/Subtype") != "/Image" for item in objects.values())
bounds = {}
for name in ["banana-layout.png", "svg-independent.png", "pdf-independent.png"]:
    image = Image.open(directory / name).convert("RGB")
    ink = image.convert("L").point(lambda value: 255 if value < 220 else 0)
    box = ink.getbbox()
    assert box is not None
    # Pixel rounding is at most one pixel per edge. Observe actual rendered ink,
    # independently of the planner's boxes or the preview's dashed overlay.
    assert box[0] >= 10 / 25.4 * 150 - 2 and box[1] >= 10 / 25.4 * 150 - 2
    assert image.width - box[2] >= 10 / 25.4 * 150 - 2
    assert image.height - box[3] >= 10 / 25.4 * 150 - 2
    bounds[name] = {"size": list(image.size), "inkBox": list(box)}
reference = bounds["banana-layout.png"]["inkBox"]
for value in bounds.values():
    assert max(abs(a - b) for a, b in zip(reference, value["inkBox"])) <= 2
images = [Image.open(directory / name).convert("RGB") for name in bounds]
gallery = Image.new("RGB", (sum(image.width for image in images), max(image.height for image in images)), "white")
offset = 0
for image in images:
    gallery.paste(image, (offset, 0))
    offset += image.width
gallery.save(directory / "comparison-gallery.png")
result = {"status": "PASS", "pdfSizeMm": [210, 297], "pdfPages": 1, "pdfImageXObjects": 0,
          "actualInkInside10mmBorder": True, "crossRendererInkEdgesWithin2px": True, "renders": bounds,
          "limit": "Digital representative fixture, not physical printer or participant acceptance"}
(directory / "independent-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))

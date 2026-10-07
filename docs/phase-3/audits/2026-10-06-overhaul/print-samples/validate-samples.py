"""Independently reopen every sample PDF and verify page counts/mm dimensions."""
import json
from datetime import datetime, timezone
from pathlib import Path
from pypdf import PdfReader

directory = Path(__file__).resolve().parent
samples = json.loads((directory / "sample-results.json").read_text(encoding="utf8"))
pages_checked = 0
for sample in samples["records"]:
    reader = PdfReader(directory / sample["pdf"])
    assert len(reader.pages) == sample["pageCount"], sample["name"]
    for page in reader.pages:
        width_mm = float(page.mediabox.width) * 25.4 / 72
        height_mm = float(page.mediabox.height) * 25.4 / 72
        assert abs(width_mm - sample["widthMm"]) < 0.01, sample["name"]
        assert abs(height_mm - sample["heightMm"]) < 0.01, sample["name"]
        pages_checked += 1
result = {"runAt": datetime.now(timezone.utc).isoformat(), "pdfs": len(samples["records"]),
          "pages": pages_checked, "all_mm_dimensions_verified": True,
          "physical_and_participant_acceptance": "Pending"}
(directory / "independent-pdf-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
print(json.dumps(result))

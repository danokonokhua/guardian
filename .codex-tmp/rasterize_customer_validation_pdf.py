from pathlib import Path

from pdf2image import convert_from_path


render_dir = Path(r"C:\Users\okdan\Documents\ChatGPT\Guardian\.codex-tmp\customer-validation-render")
pdf_path = render_dir / "Guardian_Customer_Validation_Tracker.pdf"

for existing in render_dir.glob("page-*.png"):
    existing.unlink()

pages = convert_from_path(str(pdf_path), dpi=150, thread_count=4)
for index, page in enumerate(pages, start=1):
    page.save(render_dir / f"page-{index}.png", "PNG")

print(f"pages={len(pages)}")

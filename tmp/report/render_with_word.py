"""Use the canonical DOCX renderer with installed Word as its PDF converter."""
import importlib.util
import pathlib
import shutil
import subprocess
import sys

skill = pathlib.Path(r"C:/Users/ASUS/.codex/plugins/cache/openai-primary-runtime/documents/26.1015.12040/skills/documents")
spec = importlib.util.spec_from_file_location("canonical_docx_renderer", skill / "render_docx.py")
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

def word_convert(docx, profile, directory, stem, **kwargs):
    pdf = pathlib.Path(directory) / (stem + ".pdf")
    adjacent = pathlib.Path(docx).with_suffix(".pdf")
    if adjacent.exists() and adjacent.stat().st_mtime >= pathlib.Path(docx).stat().st_mtime:
        shutil.copy2(adjacent,pdf)
        return str(pdf),"Used current PDF exported by Microsoft Word."
    result = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
        str(pathlib.Path(__file__).with_name("export_word.ps1")), "-Docx", str(pathlib.Path(docx).resolve()),
        "-Pdf", str(pdf.resolve())], capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return str(pdf), result.stdout

renderer.convert_to_pdf = word_convert
renderer.main()

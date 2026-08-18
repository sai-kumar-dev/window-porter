from pathlib import Path
import hashlib, json, shutil, zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VERSION = "0.3.0"
RUNTIME = [
    "background.js", "core.js", "popup.html", "popup.css", "popup.js",
    "blocked.html", "blocked.js", "icons", "LICENSE", "PRIVACY.md",
    "SECURITY.md", "FORMAT.md", "schemas"
]
VARIANTS = {
    "Chromium": ROOT / "manifests/chromium.json",
    "Firefox-139plus-Full": ROOT / "manifests/firefox-full.json",
    "Firefox-Legacy-ESR": ROOT / "manifests/firefox-legacy.json",
}

def copy_runtime(dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for rel in RUNTIME:
        src = ROOT / rel
        target = dst / rel
        if src.is_dir(): shutil.copytree(src, target)
        else: shutil.copy2(src, target)

def zip_dir(folder: Path, output: Path):
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob("*")):
            if p.is_file(): z.write(p, p.relative_to(folder))

def main():
    if DIST.exists(): shutil.rmtree(DIST)
    DIST.mkdir()
    outputs = []
    for name, manifest in VARIANTS.items():
        folder = DIST / name
        copy_runtime(folder)
        shutil.copy2(manifest, folder / "manifest.json")
        json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        out = ROOT.parent / f"WindowPorter-v{VERSION}-{name}.zip"
        zip_dir(folder, out)
        outputs.append(out)

    checksums = []
    for out in outputs:
        checksums.append(f"{hashlib.sha256(out.read_bytes()).hexdigest()}  {out.name}")
    (DIST / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8")
    return outputs

if __name__ == "__main__":
    for p in main(): print(p)

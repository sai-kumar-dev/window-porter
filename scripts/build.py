import os
import stat
import json
import time
import shutil
import zipfile
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

def get_version():
    with open(ROOT / "package.json") as f:
        return json.load(f)["version"]

VERSION = get_version()

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

def get_source_epoch():
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch is None:
        try:
            epoch = subprocess.check_output(["git", "log", "-1", "--format=%ct"], cwd=ROOT, stderr=subprocess.DEVNULL).decode().strip()
        except Exception:
            epoch = "315532800" # 1980-01-01
    return int(epoch)

def get_zip_datetime(epoch):
    # zip files do not support years before 1980
    dt = time.gmtime(epoch)
    if dt.tm_year < 1980:
        return (1980, 1, 1, 0, 0, 0)
    return (dt.tm_year, dt.tm_mon, dt.tm_mday, dt.tm_hour, dt.tm_min, dt.tm_sec)

def copy_runtime(dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for rel in RUNTIME:
        src = ROOT / rel
        target = dst / rel
        if src.is_dir(): shutil.copytree(src, target)
        else: shutil.copy2(src, target)

def zip_dir(folder: Path, output: Path, zip_time):
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob("*")):
            if not p.is_file():
                continue
            arcname = str(p.relative_to(folder)).replace(os.sep, "/")
            zinfo = zipfile.ZipInfo(arcname, zip_time)
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            zinfo.create_system = 3 # Unix
            zinfo.external_attr = 0o644 << 16
            with open(p, "rb") as f:
                z.writestr(zinfo, f.read())

def main():
    if DIST.exists(): shutil.rmtree(DIST)
    DIST.mkdir()
    epoch = get_source_epoch()
    zip_time = get_zip_datetime(epoch)
    
    outputs = []
    # Build deterministically
    for name, manifest in sorted(VARIANTS.items()):
        folder = DIST / name
        copy_runtime(folder)
        shutil.copy2(manifest, folder / "manifest.json")
        json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        out = DIST / f"WindowPorter-v{VERSION}-{name}.zip"
        zip_dir(folder, out, zip_time)
        outputs.append(out)

    checksums = []
    for out in sorted(outputs):
        checksums.append(f"{hashlib.sha256(out.read_bytes()).hexdigest()}  {out.name}")
    (DIST / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8")
    return outputs

if __name__ == "__main__":
    for p in main(): print(p)

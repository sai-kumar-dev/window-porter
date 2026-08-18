import subprocess, sys, json, re, glob
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def run_step(name, func):
    print(f"Running {name}...")
    try:
        func()
        print(f"[PASS] {name}")
    except Exception as e:
        print(f"[FAIL] {name}\nError: {e}")
        return False
    return True

def check_unit_tests():
    subprocess.check_call(["npm", "test"], cwd=ROOT, stdout=subprocess.DEVNULL)

def check_wps_schema():
    json.loads((ROOT / "schemas/wps-v1.schema.json").read_text(encoding="utf-8"))

def check_manifests():
    manifests = ["manifest.json"] + glob.glob("manifests/*.json")
    for m in manifests:
        json.loads((ROOT / m).read_text(encoding="utf-8"))

def check_version_consistency():
    pkg_ver = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    manifests = ["manifest.json"] + glob.glob("manifests/*.json")
    for m in manifests:
        mv = json.loads((ROOT / m).read_text(encoding="utf-8")).get("version")
        if mv != pkg_ver:
            raise ValueError(f"Version mismatch: {m} has {mv}, package.json has {pkg_ver}")

def check_permissions():
    allowed_chromium = {"tabs", "tabGroups", "downloads", "storage", "alarms"}
    allowed_firefox_legacy = {"tabs", "downloads", "storage", "alarms"}
    
    for m in ["manifest.json", "manifests/chromium.json", "manifests/firefox-full.json"]:
        p = set(json.loads((ROOT / m).read_text(encoding="utf-8")).get("permissions", []))
        if p != allowed_chromium:
            raise ValueError(f"Unexpected permissions in {m}: {p}")
            
    m = "manifests/firefox-legacy.json"
    p = set(json.loads((ROOT / m).read_text(encoding="utf-8")).get("permissions", []))
    if p != allowed_firefox_legacy:
        raise ValueError(f"Unexpected permissions in {m}: {p}")

def check_host_permissions():
    manifests = ["manifest.json"] + glob.glob("manifests/*.json")
    for m in manifests:
        data = json.loads((ROOT / m).read_text(encoding="utf-8"))
        if "host_permissions" in data or "content_scripts" in data:
            raise ValueError(f"Host permissions or content scripts found in {m}")

def check_network_calls():
    # Only search in runtime code
    files = []
    for ext in ["*.js", "*.html"]:
        files.extend(ROOT.rglob(ext))
    
    bad_patterns = [
        r"fetch\(", r"XMLHttpRequest", r"WebSocket", r"EventSource", r"navigator\.sendBeacon"
    ]
    for f in files:
        if "tests" in f.parts or "scripts" in f.parts: continue
        content = f.read_text(encoding="utf-8", errors="ignore")
        for p in bad_patterns:
            if re.search(p, content):
                raise ValueError(f"Found {p} in {f.name}")

def check_secret_scan():
    for f in ROOT.rglob("*"):
        if f.is_dir(): continue
        if ".git" in f.parts: continue
        if f.suffix in [".pem", ".key", ".p12", ".pfx"] or f.name.startswith(".env"):
            raise ValueError(f"Secret file found: {f}")

def check_deterministic_build():
    subprocess.check_call([sys.executable, "scripts/verify_reproducible_build.py"], cwd=ROOT, stdout=subprocess.DEVNULL)

def check_zip_integrity():
    for z in (ROOT / "dist").glob("*.zip"):
        with zipfile.ZipFile(z, 'r') as zf:
            bad = zf.testzip()
            if bad:
                raise ValueError(f"Corrupt ZIP file {z.name}, bad file: {bad}")
            if "manifest.json" not in zf.namelist():
                raise ValueError(f"manifest.json missing in {z.name}")

def main():
    steps = [
        ("unit tests", check_unit_tests),
        ("WPS schema", check_wps_schema),
        ("manifests", check_manifests),
        ("version consistency", check_version_consistency),
        ("permissions", check_permissions),
        ("host permissions", check_host_permissions),
        ("application network calls", check_network_calls),
        ("secret/key scan", check_secret_scan),
        ("deterministic build", check_deterministic_build),
        ("ZIP integrity", check_zip_integrity),
    ]
    
    all_pass = True
    print("Window Porter Release Verification\n")
    for name, func in steps:
        if not run_step(name, func):
            all_pass = False
            
    if all_pass:
        print("\nRELEASE VERIFICATION: PASS")
        sys.exit(0)
    else:
        print("\nRELEASE VERIFICATION: FAIL")
        sys.exit(1)

if __name__ == "__main__":
    main()

import sys, shutil, subprocess, hashlib, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build_in_dir(tmpdir: Path):
    if tmpdir.exists():
        shutil.rmtree(tmpdir)
    shutil.copytree(ROOT, tmpdir, ignore=shutil.ignore_patterns("dist", ".git", "__pycache__", "*.pyc"))
    subprocess.check_call(["python3", "scripts/build.py"], cwd=tmpdir)
    
    checksums = {}
    for p in (tmpdir / "dist").glob("*.zip"):
        checksums[p.name] = hashlib.sha256(p.read_bytes()).hexdigest()
    return checksums

def main():
    tmp_a = ROOT.parent / "build_a_test"
    tmp_b = ROOT.parent / "build_b_test"
    
    print("Building A...")
    hashes_a = build_in_dir(tmp_a)
    print("Building B...")
    hashes_b = build_in_dir(tmp_b)
    
    shutil.rmtree(tmp_a)
    shutil.rmtree(tmp_b)
    
    all_pass = True
    for name in hashes_a:
        print(f"{name}:")
        if hashes_a[name] == hashes_b.get(name):
            print("PASS — identical\n")
        else:
            print("FAIL")
            print(f"Build A: {hashes_a[name]}")
            print(f"Build B: {hashes_b.get(name)}\n")
            all_pass = False
            
    if not all_pass:
        sys.exit(1)

if __name__ == "__main__":
    main()

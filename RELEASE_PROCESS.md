# Release Process

This document outlines the canonical release procedure for Window Porter.

## Steps

1. **Clean working tree**: Ensure you have no uncommitted changes and no untracked generated files.
2. **Version consistency**: Update the version string in `package.json` and all `manifests/*.json` files.
3. **Release verification**: Run the full validation suite:
   ```bash
   python3 scripts/verify_release.py
   ```
   This performs unit tests, WPS schema validation, manifest validation, version checks, permission audits, network API guards, secret/signing key scans, deterministic build creation, and ZIP integrity checks.
4. **Commit & CI**: Commit changes and push to verify GitHub Actions CI passes.
5. **Tagging**: Create an annotated tag for the release:
   ```bash
   git tag -a v0.3.1 -m "Window Porter v0.3.1"
   git push origin v0.3.1
   ```
6. **Rebuild**: Rebuild from the exact tagged commit in the canonical environment (Ubuntu Linux, Python 3.12+). The `verify_release.py` script automatically generates the artifacts in `dist/`.
7. **GitHub Release**: Create a GitHub Release pointing to the new tag.
8. **Attach artifacts**: Attach the exact `WindowPorter-*.zip` files and `SHA256SUMS.txt` from the `dist/` directory.

No private signing keys should ever be attached to the release or committed to the repository.

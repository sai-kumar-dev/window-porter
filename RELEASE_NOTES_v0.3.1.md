# Window Porter v0.3.1 — Reproducible Builds & Release Hardening

This release hardens Window Porter's build and release pipeline. Browser runtime behavior is intentionally unchanged. Release archives are now generated deterministically under the documented canonical build process, reproducibility is enforced in CI, and release verification includes permission, network, secret, schema, archive, and version-consistency checks.

**Highlights:**
- **Deterministic ZIP packaging**: Build output is byte-for-byte reproducible from source.
- **Release verification tooling**: New `verify_release.py` covers schema validation, security scanning, and integrity checks.
- **CI hardening**: Automatically verifies reproducible builds and ensures supply-chain integrity on push/PR.
- **Fixture tests**: Added testing capabilities for malicious/invalid WPS sessions.

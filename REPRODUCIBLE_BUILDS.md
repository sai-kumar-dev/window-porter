# Reproducible Builds

Window Porter builds are deterministic. The exact same source code commit will always produce the exact same byte-for-byte `.zip` artifacts, ensuring supply-chain integrity.

## How it works

- **Timestamps**: Archive timestamps are set deterministically using the `SOURCE_DATE_EPOCH` environment variable. If not set, it falls back to the timestamp of the latest Git commit (`git log -1 --format=%ct`). If neither is available, it uses `1980-01-01`.
- **File ordering**: Files are added to the ZIP archive in strict alphabetical order.
- **Permissions**: ZIP external file attributes are normalized to `0o644` (Unix standard file permission) for consistency across OSes.
- **Compression**: Standard `ZIP_DEFLATED` is used.
- **System attribute**: Hardcoded to `3` (Unix) to avoid Windows/Unix cross-OS ZIP variations.

## Verifying Reproducibility

You need:
- Node.js (for running unit tests during verification)
- Python 3.12+

To run the reproducibility test, which builds the project twice in isolated directories and compares the SHA-256 hashes:

```bash
python3 scripts/verify_reproducible_build.py
```

This runs automatically in CI.

# Architecture

Window Porter follows a portable-format-first design.

```text
Browser APIs
    ↓
Capture / restore adapter behavior
    ↓
Normalized WPS v1 model
    ↓
Portable .wps.json file
```

## Principles

1. **The file is portable state.** Browser-internal IDs are never persisted as authoritative identifiers.
2. **Local first.** No backend is required.
3. **Minimal privilege.** No page-content, cookie, history, or arbitrary host access.
4. **Graceful degradation.** Unsupported group/window features produce warnings rather than total restore failure.
5. **Inspectable formats.** JSON/TXT/HTML remain human/tool friendly.
6. **Backward readability.** WPS format version changes must be explicit and migrations should preserve old files.

## Main modules

- `core.js` — format helpers, validation, selection/filtering utilities, TXT/HTML conversion
- `background.js` — browser API capture/restore, downloads, safety snapshots, restore reports
- `popup.*` — user interface for save, selection, inspection, restore and recovery
- `manifests/` — browser-specific manifests
- `schemas/` — machine-readable WPS schema
- `scripts/build.py` — deterministic browser-variant packaging

## Security boundary

Window Porter deals with browser metadata such as URLs/titles and tab/window state. It intentionally does not cross into page DOM, cookies, passwords, website storage, or request interception.

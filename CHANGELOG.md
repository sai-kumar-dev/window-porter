# Changelog

## 0.3.0 — 2026-08-18

Public beta release.

### Portable session foundation

- Browser-neutral WPS v1 format.
- Current-window and all-normal-window capture.
- JSON/TXT/HTML export and JSON/TXT import.
- Tab order, active state, pinned state, muted state, groups, group metadata, and window metadata.
- Browser-generated group IDs are normalized to portable WPS IDs.

### Selective save and restore

- Select whole windows, groups, individual grouped tabs, or ungrouped tabs.
- Selection-mode toggle preserves fast save-all as the default workflow.
- Search and filter selectors.
- All / None / Invert controls.
- Expand / Collapse controls.
- Live selected-tab counts.
- Partial group selection preserves membership for selected members.
- Imported-session inspection and selective restore.

### Restore behavior

- New-window, append-current, and replace-current restore modes.
- Exact-URL duplicate policies: keep, skip, or reuse where supported by the restore flow.
- Optional window geometry restore.
- Restore reports with created/reused/skipped/recovery/group/warning counts.
- Restricted/internal URL recovery page.
- Imported-URL safety guard for `javascript:`, `data:`, and `blob:` schemes.

### Recovery

- Opt-in local safety snapshots.
- Manual snapshot action.
- Configurable interval and retention.
- Startup re-registration of snapshot alarms.

### Browser support

- Dedicated Chromium build.
- Dedicated Firefox 139+ Full build.
- Dedicated Firefox Legacy/ESR build.
- Firefox Legacy omits the newer `tabGroups` permission.
- Group restore degrades in layers: full metadata, membership-only, or flattened tabs.

### Project / open source

- MIT license.
- Privacy and security documentation.
- WPS format specification and JSON schema.
- Compatibility, architecture, support, roadmap, and contributing documentation.
- GitHub issue/PR templates and CI workflow.
- Deterministic multi-browser release build script and SHA-256 output.

### Privacy model

- No cloud backend.
- No account requirement.
- No telemetry or analytics.
- No content scripts or host permissions.
- No cookie, history, password, or request-interception access.

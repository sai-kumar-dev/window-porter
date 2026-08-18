# Window Porter

**Portable, private browser sessions — saved as files.**

Window Porter captures a browser window (or all normal windows) into a browser-neutral **WPS JSON** session file that can be inspected, selectively restored, archived, or moved to another supported desktop browser.

No account. No cloud. No telemetry. No page-content access.

```text
Chrome / Edge / Brave / Vivaldi / Opera
                ↓
          session.wps.json
                ↓
             Firefox
```

> Public beta: **v0.3.0**. WPS format version: **1**.

## Why Window Porter?

Browser history answers *where did I go?* Window Porter preserves *what workspace did I intentionally have open?*

Use it to:

- move a research/development/application window between browsers or machines
- archive a browser workspace without depending on browser history or a vendor account
- keep tab order, pinned tabs, groups, and active state together
- select only the windows/groups/tabs you actually want
- restore only part of a saved session
- keep a human-readable TXT/HTML fallback next to the structured session

## Highlights in v0.3.0

### Save

- current window or all normal browser windows
- URL and title
- exact tab order
- active tab
- pinned tabs
- muted state
- tab groups
- group title, color, and collapsed state when supported
- window state and optional bounds metadata
- optional **Choose groups / tabs** selector
- select whole windows, whole groups, individual grouped tabs, or ungrouped tabs
- search/filter tabs
- All / None / Invert selection controls
- live selected-tab counts
- optional privacy-clean URL export
- `Ctrl+Shift+9` instant current-window snapshot

### Portable outputs

Every structured save produces a `.wps.json` file. Optional fallbacks:

- `.urls.txt` — one URL per line
- `.html` — clickable human-readable archive

Example:

```text
Downloads/
└── WindowPorter/
    ├── AI-Research__2026-08-18_12-05-12.wps.json
    ├── AI-Research__2026-08-18_12-05-12.urls.txt
    └── AI-Research__2026-08-18_12-05-12.html
```

### Inspect and selectively restore

Before restoring, Window Porter can inspect the imported session and show its windows, groups, tabs, pinned state, and compatibility notes.

Restore selection supports the same window/group/tab granularity as save selection, so a 100-tab archive does **not** have to be restored all at once.

Restore modes:

- **New window** — safest default
- **Append to current window**
- **Replace current window** — saved tabs are created before old tabs are removed

Duplicate policies include:

- keep all
- skip exact-URL duplicates
- reuse/focus existing exact-URL tabs where supported by the current restore flow

After restore, Window Porter produces a restore report including created/reused/skipped tabs, group reconstruction, recovery tabs, and warnings.

### Local safety snapshots

Optional safety snapshots can be enabled for local recovery.

- off by default
- manual **Snapshot now**
- optional 15 min / 30 min / 1 h / 3 h cadence
- configurable local retention
- stored only in extension storage
- no cloud sync or remote backend

## Browser support

| Browser | Export | Restore | Group metadata | Build |
|---|---:|---:|---:|---|
| Chrome | ✅ | ✅ | ✅ | Chromium |
| Edge | ✅ | ✅ | ✅ | Chromium |
| Brave | ✅ | ✅ | ✅* | Chromium |
| Vivaldi | ✅ | ✅ | ✅* | Chromium |
| Opera / Opera GX | ✅ | ✅ | ✅* | Chromium |
| Chromium derivatives | ✅* | ✅* | ✅* | Chromium |
| Firefox 139+ | ✅ | ✅ | ✅ | Firefox Full |
| Firefox 138 | ✅ | ✅ | Partial | Firefox Legacy/ESR |
| Older Firefox / ESR | ✅ | ✅ | Graceful flattening | Firefox Legacy/ESR |
| Safari macOS | Planned | Planned | TBD | Not shipped |

`*` Expected when the browser exposes compatible Chromium extension/tab-group APIs. Treat less-common Chromium derivatives as compatibility targets until they are field-tested.

See [COMPATIBILITY.md](COMPATIBILITY.md) for details and intentional portability limits.

## Install — Chromium browsers

Use the **Chromium** release ZIP for Chrome, Edge, Brave, Vivaldi, Opera, and compatible Chromium derivatives.

1. Extract the ZIP.
2. Open the browser extension page.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the extracted folder containing `manifest.json`.

Common extension pages:

```text
Chrome       chrome://extensions
Edge         edge://extensions
Brave        brave://extensions
Vivaldi      vivaldi://extensions
Opera        opera://extensions
```

## Install — Firefox

Window Porter ships two Firefox manifests because Firefox gained tab-group WebExtension capabilities later than Chromium.

### Firefox 139+ Full

Use the **Firefox-139plus-Full** release ZIP for complete group metadata support.

### Firefox Legacy / ESR

Use **Firefox-Legacy-ESR** when the full build is rejected by an older/corporate Firefox build. It deliberately omits the newer `tabGroups` permission.

For local testing:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select the extracted build's `manifest.json`.

Persistent public Firefox distribution requires the normal Mozilla signing/distribution path.

## Privacy and permissions

Window Porter intentionally has no application backend and no page-content access.

Chromium / Firefox Full permissions:

```text
tabs
tabGroups
downloads
storage
alarms
```

Firefox Legacy omits `tabGroups`.

Why they exist:

- `tabs` — read tab URL/title and tab state required for a portable snapshot
- `tabGroups` — read/update group metadata where the browser supports it
- `downloads` — write WPS/TXT/HTML files to the normal downloads location
- `storage` — store preferences and opt-in local safety snapshots
- `alarms` — schedule opt-in local safety snapshots

Window Porter does **not** request:

```text
<all_urls>
cookies
history
webRequest
scripting
content scripts
password access
website localStorage/sessionStorage
```

It contains no analytics, telemetry, ads, cloud sync, remote scripts, or application network calls.

Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## What Window Porter intentionally does not copy

The WPS format does not clone browser identity or live application memory. It intentionally does not contain:

- cookies or login sessions
- passwords
- OAuth/session storage
- unsent form contents
- exact scroll position
- arbitrary in-page JavaScript state
- media playback state unless encoded in the URL

A URL itself can contain a private token. Exact export is the default for restore fidelity; the optional privacy-clean mode removes common analytics and token-like URL parameters.

## Internal and restricted URLs

Some browser-internal or extension-owned URLs cannot be reopened by another extension/browser. Window Porter preserves the original URL and creates a local recovery page instead of silently dropping it.

## WPS — Window Portable Session

The canonical session format is plain JSON:

```json
{
  "format": "windowporter",
  "formatVersion": 1
}
```

Browser-generated tab/group IDs are never authoritative. Window Porter uses portable IDs inside the file, which is what makes cross-browser restore possible.

The WPS v1 specification is documented in [FORMAT.md](FORMAT.md), with a machine-readable schema in [`schemas/wps-v1.schema.json`](schemas/wps-v1.schema.json).

## Repository layout

```text
.
├── background.js
├── core.js
├── popup.html / popup.css / popup.js
├── blocked.html / blocked.js
├── icons/
├── manifests/
│   ├── chromium.json
│   ├── firefox-full.json
│   └── firefox-legacy.json
├── schemas/
├── tests/
├── scripts/build.py
├── .github/
├── FORMAT.md
├── PRIVACY.md
├── SECURITY.md
├── COMPATIBILITY.md
├── CONTRIBUTING.md
└── ROADMAP.md
```

No framework, bundler, runtime package install, CDN, or remote dependency is required by the extension itself.

## Development

Run the core tests:

```bash
npm test
```

Build all release variants:

```bash
python3 scripts/build.py
```

The CI workflow validates core tests, JSON files, and release builds on pushes and pull requests.

## Status and roadmap

v0.3.0 is a **public beta**. The focus before v1.0 is field testing and portability reliability, not feature bloat.

See [ROADMAP.md](ROADMAP.md).

## Contributing

Bug reports and portability-focused improvements are welcome. Please remove private URLs/tokens from any fixture or screenshot before posting it publicly.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SUPPORT.md](SUPPORT.md).

## License

MIT — see [LICENSE](LICENSE).

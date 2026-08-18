# Compatibility

Window Porter is designed around a browser-neutral WPS file plus thin WebExtension adapters.

| Browser | Export | Restore | Full group metadata | Build | Status |
|---|---:|---:|---:|---|---|
| Chrome | Yes | Yes | Yes | Chromium | Supported |
| Edge | Yes | Yes | Yes | Chromium | Supported |
| Brave | Yes | Yes | Expected* | Chromium | Compatibility target |
| Vivaldi | Yes | Yes | Expected* | Chromium | Compatibility target |
| Opera / Opera GX | Yes | Yes | Expected* | Chromium | Compatibility target |
| Chromium / derivatives | Expected* | Expected* | Expected* | Chromium | Compatibility target |
| Firefox 139+ | Yes | Yes | Yes | Firefox Full | Supported |
| Firefox 138 | Yes | Yes | Partial | Legacy/ESR | Compatibility |
| Older Firefox / ESR | Yes | Yes | Graceful flattening | Legacy/ESR | Compatibility |
| Safari macOS | Planned | Planned | TBD | Not shipped | Roadmap |
| Mobile browsers | Not a v0.3 target | Not a v0.3 target | — | — | Separate problem |

`*` Depends on the derivative exposing compatible Chromium extension and tab-group APIs. Public claims should distinguish **supported/field-tested** from **expected compatible** until real-browser testing is recorded.

## Cross-browser rule

The portable file is authoritative; browser-generated tab/group IDs are not.

```text
Browser API → Window Porter adapter → WPS v1 → target adapter → target browser
```

A feature unsupported by the target browser should degrade gracefully rather than make the entire restore fail.

## Intentional portability limits

Window Porter cannot guarantee exact transfer of:

- browser-internal pages
- pages owned by another extension
- cookies/login state
- passwords
- unsent form state
- scroll position
- in-page JavaScript memory
- media playback position unless encoded in the URL
- window coordinates across different monitor layouts

When an internal URL cannot be recreated, Window Porter opens a local recovery page containing the original URL.

# GitHub Release Checklist — v0.3.0 Public Beta

## Repository

- [ ] Create public repository named `window-porter` (or the owner's chosen final name)
- [ ] Description: `Portable, private browser sessions — save, inspect and restore browser windows across modern desktop browsers.`
- [ ] Add topics: `browser-extension`, `webextension`, `tabs`, `session-manager`, `privacy`, `chrome-extension`, `firefox-extension`, `cross-browser`, `productivity`, `javascript`
- [ ] Default branch is `main`
- [ ] MIT license visible
- [ ] README renders correctly
- [ ] Issues enabled
- [ ] GitHub Actions enabled

## Pre-publish safety

- [ ] Confirm no `.pem`, `.key`, `.p12`, `.env`, browser profile, cookies, tokens, or credentials are committed
- [ ] Confirm no private/corporate URLs exist in tests/docs/examples
- [ ] Confirm no generated signing key is included
- [ ] Confirm permissions match the documented minimal set
- [ ] Confirm no host permissions or application network calls were introduced

## Quality

- [ ] `npm test`
- [ ] `python scripts/build.py`
- [ ] JSON manifests/schema parse successfully
- [ ] Inspect generated ZIPs
- [ ] Chromium load-unpacked smoke test
- [ ] Firefox Full smoke test on Firefox 139+
- [ ] Firefox Legacy/ESR smoke test where available

## Publish

- [ ] Commit source as `v0.3.0 public beta`
- [ ] Push `main`
- [ ] Create annotated tag `v0.3.0`
- [ ] Push tag
- [ ] Create GitHub Release `Window Porter v0.3.0 — Public Beta`
- [ ] Use `RELEASE_NOTES_v0.3.0.md` as the release body, polishing only for accuracy
- [ ] Attach Chromium ZIP
- [ ] Attach Firefox 139+ Full ZIP
- [ ] Attach Firefox Legacy/ESR ZIP
- [ ] Attach `SHA256SUMS.txt`
- [ ] Mark release as **pre-release**

## After publish

- [ ] Verify release downloads and checksums
- [ ] Verify README links
- [ ] Verify Actions passes on `main`
- [ ] Create milestone `v1.0 stabilization`
- [ ] Seed issues from ROADMAP only where actionable

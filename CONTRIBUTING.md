# Contributing

Window Porter favors small, auditable, browser-neutral code.

## Principles

- Keep the WPS file browser-neutral.
- Prefer graceful degradation over browser-specific failure.
- Do not add telemetry, remote code, or cloud requirements to core behavior.
- Avoid content scripts and host permissions unless a feature cannot exist without them and the tradeoff is explicitly reviewed.
- Preserve backward readability of WPS v1 files.

## Development

```bash
npm test
python3 scripts/build.py
```

Before a pull request, verify:

- JavaScript syntax
- core unit tests
- all manifests parse as JSON
- WPS schema parses
- Chromium package loads/validates when Chromium is available
- no unintended host/content/cookie/history permissions

Bug reports should include source browser/version, target browser/version, and sanitized reproduction steps.

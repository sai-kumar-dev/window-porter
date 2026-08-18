# Security model

Window Porter is intentionally small and local-only.

## Data it reads
Through WebExtension tab APIs:
- URL
- title
- tab position
- active/pinned/muted state
- tab-group ID and group metadata
- browser window state/bounds

## Data it does not request
- cookies
- browsing history API
- page DOM/content
- passwords
- localStorage/sessionStorage from websites
- request interception
- arbitrary host access

## Network
The extension contains no application network calls and no remote code.

Restoring a URL naturally causes the browser itself to navigate to that URL, exactly as opening the page normally would.

## Exported URLs may themselves be sensitive
Some sites place temporary tokens or private identifiers in URLs. Store session files with the same care you would use for bookmarks containing private links.

The optional privacy-clean export removes common tracking parameters and token-like values, but can reduce restore fidelity. Exact export remains the default.

## Import safety
The importer validates the WPS format and enforces a hard limit of 5,000 tabs to reduce accidental or malicious resource exhaustion. Sessions above 500 tabs require an additional UI confirmation.

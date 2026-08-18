# WPS — Window Portable Session v1

WPS v1 is an open JSON representation of browser-window structure.

Minimum discriminator:

```json
{
  "format": "windowporter",
  "formatVersion": 1
}
```

## Design rules

1. Browser-generated tab/group/window IDs are not portable and are never authoritative.
2. Tabs use a zero-based `position` inside each saved window.
3. Groups use local IDs such as `g1`, `g2` and tabs reference those IDs.
4. Unsupported target-browser features degrade with warnings rather than failing the entire restore.
5. Authentication/session secrets are outside the format's scope.

## Top-level fields

- `format`: `windowporter`
- `formatVersion`: `1`
- `createdAt`: ISO timestamp
- `name`: human label
- `scope`: `current-window` or `all-windows`
- `generator`: producer metadata
- `privacyClean`: whether URL sanitization was enabled
- `selection`: optional selection metadata
- `windows`: one or more window records

## Window

A window may contain:

- `ordinal`
- `state`
- `focused`
- `incognito` (informational; restore does not recreate private credentials/state)
- `bounds`
- `groups`
- `tabs`

## Group

- `id`
- `title`
- `color`
- `collapsed`
- `firstPosition`

## Tab

- `position`
- `url`
- `title`
- `pinned`
- `active`
- `muted`
- `group` (`null` or a local group ID)

The machine-readable schema is `schemas/wps-v1.schema.json`.

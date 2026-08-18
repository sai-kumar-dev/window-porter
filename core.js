(() => {
  "use strict";

  const FORMAT = "windowporter";
  const FORMAT_VERSION = 1;
  const MAX_TABS = 5000;
  const GROUP_NONE = -1;

  const TRACKING_KEYS = new Set([
    "gclid", "dclid", "fbclid", "msclkid", "mc_cid", "mc_eid",
    "igshid", "yclid", "_hsenc", "_hsmi"
  ]);

  const SENSITIVE_KEYS = new Set([
    "access_token", "id_token", "auth_token", "oauth_token",
    "token", "sso_token", "ticket"
  ]);

  const GROUP_COLORS = new Set([
    "grey", "blue", "red", "yellow", "green",
    "pink", "purple", "cyan", "orange"
  ]);

  function localTimestamp(date = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  }

  function cleanFilenamePart(value) {
    const cleaned = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\-\s]+|[.\-\s]+$/g, "");
    return (cleaned || "Window").slice(0, 100);
  }

  function buildBaseName(name, date = new Date()) {
    return `${cleanFilenamePart(name)}__${localTimestamp(date)}`;
  }

  function sanitizeUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl) return rawUrl;
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return rawUrl;

      const keys = Array.from(url.searchParams.keys());
      for (const key of keys) {
        const lower = key.toLowerCase();
        if (lower.startsWith("utm_") || TRACKING_KEYS.has(lower) || SENSITIVE_KEYS.has(lower)) {
          url.searchParams.delete(key);
        }
      }

      if (url.hash && url.hash.includes("=")) {
        const rawHash = url.hash.slice(1);
        const hashParams = new URLSearchParams(rawHash);
        let changed = false;
        for (const key of Array.from(hashParams.keys())) {
          const lower = key.toLowerCase();
          if (lower.startsWith("utm_") || TRACKING_KEYS.has(lower) || SENSITIVE_KEYS.has(lower)) {
            hashParams.delete(key);
            changed = true;
          }
        }
        if (changed) {
          const rebuilt = hashParams.toString();
          url.hash = rebuilt ? `#${rebuilt}` : "";
        }
      }

      return url.toString();
    } catch {
      return rawUrl;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeColor(color) {
    return GROUP_COLORS.has(color) ? color : "grey";
  }

  function countSession(session) {
    let tabs = 0;
    let groups = 0;
    let pinned = 0;
    for (const win of session.windows || []) {
      tabs += Array.isArray(win.tabs) ? win.tabs.length : 0;
      groups += Array.isArray(win.groups) ? win.groups.length : 0;
      pinned += Array.isArray(win.tabs) ? win.tabs.filter((t) => t.pinned).length : 0;
    }
    return { windows: (session.windows || []).length, tabs, groups, pinned };
  }

  function validateSession(input) {
    const errors = [];
    const warnings = [];

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, errors: ["Session must be a JSON object."], warnings };
    }

    if (input.format !== FORMAT) {
      errors.push(`Unsupported format "${input.format ?? "missing"}".`);
    }

    if (input.formatVersion !== FORMAT_VERSION) {
      errors.push(`Unsupported formatVersion "${input.formatVersion ?? "missing"}"; this build supports version ${FORMAT_VERSION}.`);
    }

    if (!Array.isArray(input.windows) || input.windows.length === 0) {
      errors.push("Session must contain at least one window.");
    }

    let tabCount = 0;

    if (Array.isArray(input.windows)) {
      input.windows.forEach((win, wi) => {
        if (!win || typeof win !== "object") {
          errors.push(`Window ${wi + 1} is invalid.`);
          return;
        }

        if (!Array.isArray(win.tabs) || win.tabs.length === 0) {
          errors.push(`Window ${wi + 1} must contain at least one tab.`);
          return;
        }

        const groupIds = new Set();
        if (Array.isArray(win.groups)) {
          for (const group of win.groups) {
            if (!group || typeof group !== "object" || typeof group.id !== "string" || !group.id) {
              errors.push(`Window ${wi + 1} contains an invalid group.`);
              continue;
            }
            if (groupIds.has(group.id)) {
              errors.push(`Window ${wi + 1} has duplicate group id "${group.id}".`);
            }
            groupIds.add(group.id);
          }
        }

        const positions = new Set();
        let activeCount = 0;
        win.tabs.forEach((tab, ti) => {
          tabCount += 1;
          if (!tab || typeof tab !== "object") {
            errors.push(`Window ${wi + 1}, tab ${ti + 1} is invalid.`);
            return;
          }
          if (typeof tab.url !== "string" || tab.url.trim() === "") {
            errors.push(`Window ${wi + 1}, tab ${ti + 1} has no URL.`);
          }
          if (typeof tab.url === "string" && tab.url.length > 131072) {
            errors.push(`Window ${wi + 1}, tab ${ti + 1} URL is unreasonably large.`);
          }
          if (!Number.isInteger(tab.position) || tab.position < 0) {
            errors.push(`Window ${wi + 1}, tab ${ti + 1} has an invalid position.`);
          } else if (positions.has(tab.position)) {
            errors.push(`Window ${wi + 1} has duplicate tab position ${tab.position}.`);
          } else {
            positions.add(tab.position);
          }
          if (tab.active) activeCount += 1;
          if (tab.group !== null && tab.group !== undefined && !groupIds.has(tab.group)) {
            warnings.push(`Window ${wi + 1}, tab ${ti + 1} references missing group "${tab.group}" and will be restored ungrouped.`);
          }
          if (tab.pinned && tab.group) {
            warnings.push(`Window ${wi + 1}, tab ${ti + 1} is both pinned and grouped; target browsers may ungroup or unpin it.`);
          }
        });
        if (activeCount === 0) {
          warnings.push(`Window ${wi + 1} has no active tab marker; the browser will choose an active tab.`);
        } else if (activeCount > 1) {
          warnings.push(`Window ${wi + 1} has multiple active tab markers; the last successfully activated tab may win.`);
        }
      });
    }

    if (tabCount > MAX_TABS) {
      errors.push(`Session contains ${tabCount} tabs; the safety limit is ${MAX_TABS}.`);
    }

    return { ok: errors.length === 0, errors, warnings, counts: countSession(input) };
  }

  function sessionFromTxt(text, name = "Imported URLs") {
    const urls = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    if (!urls.length) {
      throw new Error("The TXT file contains no URLs.");
    }
    if (urls.length > MAX_TABS) {
      throw new Error(`The TXT file contains ${urls.length} URLs; the safety limit is ${MAX_TABS}.`);
    }

    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      name,
      scope: "current-window",
      generator: {
        name: "Window Porter",
        version: "0.3.0",
        source: "txt-import"
      },
      windows: [
        {
          ordinal: 0,
          state: "normal",
          focused: true,
          incognito: false,
          bounds: null,
          groups: [],
          tabs: urls.map((url, index) => ({
            position: index,
            url,
            title: "",
            pinned: false,
            active: index === 0,
            muted: false,
            group: null
          }))
        }
      ]
    };
  }

  function parseImportedFile(filename, text) {
    const lower = String(filename || "").toLowerCase();
    if (lower.endsWith(".txt")) {
      return sessionFromTxt(text, cleanFilenamePart(filename.replace(/\.txt$/i, "")));
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    const validation = validateSession(parsed);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }
    return parsed;
  }

  function toTxt(session) {
    const lines = [];
    for (const win of session.windows || []) {
      for (const tab of win.tabs || []) {
        if (tab.url) lines.push(tab.url);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  function toHtml(session) {
    const name = escapeHtml(session.name || "Window Porter Session");
    const created = escapeHtml(session.createdAt || "");
    const blocks = [];

    (session.windows || []).forEach((win, wi) => {
      const groupMap = new Map((win.groups || []).map((g) => [g.id, g]));
      const tabRows = (win.tabs || []).map((tab) => {
        const group = tab.group ? groupMap.get(tab.group) : null;
        const groupText = group ? escapeHtml(group.title || group.id) : "Ungrouped";
        const title = escapeHtml(tab.title || tab.url);
        const href = escapeHtml(tab.url);
        const flags = [
          tab.pinned ? "Pinned" : "",
          tab.active ? "Active" : "",
          tab.muted ? "Muted" : ""
        ].filter(Boolean).join(" · ");

        return `<li>
          <a href="${href}" rel="noreferrer">${title}</a>
          <div class="meta">${groupText}${flags ? ` · ${escapeHtml(flags)}` : ""}</div>
          <code>${href}</code>
        </li>`;
      }).join("\n");

      blocks.push(`<section>
        <h2>Window ${wi + 1}</h2>
        <p>${(win.tabs || []).length} tabs · ${(win.groups || []).length} groups</p>
        <ol>${tabRows}</ol>
      </section>`);
    });

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { max-width: 980px; margin: 40px auto; padding: 0 22px; line-height: 1.45; }
  header { margin-bottom: 32px; }
  h1 { margin-bottom: 6px; }
  section { margin: 28px 0; }
  li { margin: 14px 0 20px; }
  a { font-weight: 650; overflow-wrap: anywhere; }
  code { display: block; margin-top: 4px; opacity: .72; overflow-wrap: anywhere; white-space: normal; }
  .meta { font-size: .9rem; opacity: .75; margin-top: 3px; }
</style>
</head>
<body>
<header>
  <h1>${name}</h1>
  <div>Created ${created} · Window Porter WPS v${FORMAT_VERSION}</div>
</header>
${blocks.join("\n")}
</body>
</html>`;
  }


  function tabRef(windowIndex, position) {
    return `w${windowIndex}:t${position}`;
  }

  function subsetSession(session, selectedRefs) {
    const validation = validateSession(session);
    if (!validation.ok) throw new Error(validation.errors.join(" "));

    const selected = selectedRefs ? new Set(selectedRefs.map(String)) : null;
    const result = JSON.parse(JSON.stringify(session));
    const windows = [];

    (session.windows || []).forEach((win, wi) => {
      const chosenTabs = (win.tabs || []).filter((tab) => !selected || selected.has(tabRef(wi, tab.position)));
      if (!chosenTabs.length) return;

      const usedGroups = new Set(chosenTabs.map((tab) => tab.group).filter(Boolean));
      const copiedGroups = (win.groups || [])
        .filter((group) => usedGroups.has(group.id))
        .map((group) => ({ ...group }));

      const copiedTabs = chosenTabs.map((tab, index) => ({ ...tab, position: index }));
      if (!copiedTabs.some((tab) => tab.active)) copiedTabs[0].active = true;
      let seenActive = false;
      for (const tab of copiedTabs) {
        if (tab.active && !seenActive) seenActive = true;
        else if (tab.active) tab.active = false;
      }

      for (const group of copiedGroups) {
        const members = copiedTabs.filter((tab) => tab.group === group.id);
        group.firstPosition = members.length ? Math.min(...members.map((tab) => tab.position)) : 0;
      }

      windows.push({ ...win, ordinal: windows.length, groups: copiedGroups, tabs: copiedTabs });
    });

    if (!windows.length) throw new Error("Select at least one tab.");
    result.windows = windows;
    result.selection = selected ? { mode: "custom", tabCount: countSession(result).tabs } : { mode: "all" };
    return result;
  }

  function sessionMeta(session) {
    const counts = countSession(session);
    return {
      ...counts,
      name: session.name || "Window Porter Session",
      createdAt: session.createdAt || "",
      sourcePlatform: session.generator && (session.generator.platform || session.generator.source) || "unknown",
      sourceVersion: session.generator && session.generator.version || "unknown",
      formatVersion: session.formatVersion
    };
  }

  globalThis.WP_CORE = {
    FORMAT,
    FORMAT_VERSION,
    MAX_TABS,
    GROUP_NONE,
    GROUP_COLORS,
    localTimestamp,
    cleanFilenamePart,
    buildBaseName,
    sanitizeUrl,
    escapeHtml,
    normalizeColor,
    countSession,
    validateSession,
    sessionFromTxt,
    parseImportedFile,
    toTxt,
    toHtml,
    tabRef,
    subsetSession,
    sessionMeta
  };
})();

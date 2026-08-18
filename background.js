/* global WP_CORE */
"use strict";

if (typeof WP_CORE === "undefined" && typeof importScripts === "function") {
  importScripts("core.js");
}

const api = typeof browser !== "undefined" ? browser : chrome;
const GROUP_NONE = -1;
const SETTINGS_KEY = "wpSettings";
const SNAPSHOTS_KEY = "wpSafetySnapshots";
const SAFETY_ALARM = "windowporter-safety-snapshot";
const DEFAULT_SETTINGS = {
  safetyEnabled: false,
  safetyIntervalMinutes: 60,
  safetyKeep: 5
};

function currentPlatform() {
  const ua = (globalThis.navigator && navigator.userAgent) || "";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Edg\//i.test(ua)) return "edge";
  if (/OPR\//i.test(ua)) return "opera";
  if (/Vivaldi\//i.test(ua)) return "vivaldi";
  if (/Brave/i.test(ua)) return "brave";
  if (/Chrome\//i.test(ua)) return "chromium";
  return "webextension";
}

async function browserIdentity() {
  let name = currentPlatform();
  let version = "unknown";
  if (api.runtime && api.runtime.getBrowserInfo) {
    try {
      const info = await api.runtime.getBrowserInfo();
      name = info.name || name;
      version = info.version || version;
    } catch { /* Chromium does not expose getBrowserInfo */ }
  }
  if (version === "unknown") {
    const ua = (globalThis.navigator && navigator.userAgent) || "";
    const match = ua.match(/(?:Firefox|Edg|OPR|Chrome|Vivaldi)\/([\d.]+)/i);
    if (match) version = match[1];
  }
  return { name, version, platform: currentPlatform() };
}

async function getCapabilities() {
  const identity = await browserIdentity();
  return {
    ...identity,
    tabs: Boolean(api.tabs),
    windows: Boolean(api.windows),
    groupMembership: Boolean(api.tabs && api.tabs.group),
    groupMetadata: Boolean(api.tabGroups && api.tabGroups.get && api.tabGroups.update),
    downloads: Boolean(api.downloads && api.downloads.download),
    storage: Boolean(api.storage && api.storage.local),
    alarms: Boolean(api.alarms && api.alarms.create),
    windowGeometry: Boolean(api.windows && api.windows.update)
  };
}

async function getWindowTabs(windowId) {
  const tabs = await api.tabs.query({ windowId });
  return tabs.slice().sort((a, b) => a.index - b.index);
}

async function getGroupDetails(browserGroupId) {
  if (!api.tabGroups || !api.tabGroups.get) return null;
  try { return await api.tabGroups.get(browserGroupId); }
  catch { return null; }
}

async function listNormalWindows(scope) {
  if (scope === "all-windows") {
    let windows = await api.windows.getAll({ windowTypes: ["normal"] });
    windows = windows.filter((win) => win.type === "normal");
    windows.sort((a, b) => Number(b.focused) - Number(a.focused));
    return windows;
  }
  return [await api.windows.getCurrent()];
}

async function getLiveStructure(scope = "current-window") {
  const windows = await listNormalWindows(scope);
  const result = [];
  for (let wi = 0; wi < windows.length; wi += 1) {
    const win = windows[wi];
    const tabs = await getWindowTabs(win.id);
    const browserGroupIds = [...new Set(
      tabs.map((tab) => tab.groupId).filter((id) => Number.isInteger(id) && id !== GROUP_NONE)
    )];

    const groups = [];
    for (let gi = 0; gi < browserGroupIds.length; gi += 1) {
      const browserId = browserGroupIds[gi];
      const details = await getGroupDetails(browserId);
      const members = tabs.filter((t) => t.groupId === browserId);
      groups.push({
        browserId,
        title: details && details.title ? details.title : `Group ${gi + 1}`,
        color: WP_CORE.normalizeColor(details && details.color),
        collapsed: Boolean(details && details.collapsed),
        tabIds: members.map((t) => t.id)
      });
    }

    result.push({
      windowId: win.id,
      ordinal: wi,
      focused: Boolean(win.focused),
      incognito: Boolean(win.incognito),
      groups,
      tabs: tabs.map((tab) => ({
        id: tab.id,
        index: tab.index,
        url: tab.pendingUrl || tab.url || "about:blank",
        title: tab.title || tab.pendingUrl || tab.url || "Untitled tab",
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        groupId: Number.isInteger(tab.groupId) && tab.groupId !== GROUP_NONE ? tab.groupId : null
      }))
    });
  }
  return { scope, windows: result };
}

async function captureWindow(win, ordinal, privacyClean, selectedTabIds) {
  const allTabs = await getWindowTabs(win.id);
  const selected = selectedTabIds ? new Set(selectedTabIds.map(Number)) : null;
  const tabs = selected ? allTabs.filter((tab) => selected.has(tab.id)) : allTabs;
  if (!tabs.length) return null;

  const browserGroupIds = [...new Set(
    tabs.map((tab) => tab.groupId).filter((id) => Number.isInteger(id) && id !== GROUP_NONE)
  )];

  const groups = [];
  for (const browserId of browserGroupIds) {
    const details = await getGroupDetails(browserId);
    const memberTabs = tabs.filter((tab) => tab.groupId === browserId);
    groups.push({
      browserId,
      firstPosition: memberTabs.length ? allTabs.indexOf(memberTabs[0]) : Number.MAX_SAFE_INTEGER,
      title: details && details.title ? details.title : "",
      color: WP_CORE.normalizeColor(details && details.color),
      collapsed: Boolean(details && details.collapsed)
    });
  }

  groups.sort((a, b) => a.firstPosition - b.firstPosition);
  const normalizedGroups = groups.map((group, i) => ({
    id: `g${i + 1}`,
    _browserId: group.browserId,
    title: group.title,
    color: group.color,
    collapsed: group.collapsed,
    firstPosition: i
  }));
  const localGroupByBrowserId = new Map(normalizedGroups.map((g) => [g._browserId, g.id]));
  const portableGroups = normalizedGroups.map(({ _browserId, ...rest }) => rest);

  const normalizedTabs = tabs.map((tab, position) => {
    const rawUrl = tab.pendingUrl || tab.url || "about:blank";
    return {
      position,
      url: privacyClean ? WP_CORE.sanitizeUrl(rawUrl) : rawUrl,
      title: tab.title || "",
      pinned: Boolean(tab.pinned),
      active: Boolean(tab.active),
      muted: Boolean(tab.mutedInfo && tab.mutedInfo.muted),
      group: localGroupByBrowserId.get(tab.groupId) || null
    };
  });

  if (!normalizedTabs.some((t) => t.active) && normalizedTabs.length) normalizedTabs[0].active = true;

  return {
    ordinal,
    state: win.state || "normal",
    focused: Boolean(win.focused),
    incognito: Boolean(win.incognito),
    bounds: {
      left: Number.isFinite(win.left) ? win.left : null,
      top: Number.isFinite(win.top) ? win.top : null,
      width: Number.isFinite(win.width) ? win.width : null,
      height: Number.isFinite(win.height) ? win.height : null
    },
    groups: portableGroups,
    tabs: normalizedTabs
  };
}

async function captureSession({ scope = "current-window", name = "", privacyClean = false, selectedTabIds = null } = {}) {
  const windows = await listNormalWindows(scope);
  if (!windows.length) throw new Error("No normal browser windows were found.");

  const captured = [];
  for (let i = 0; i < windows.length; i += 1) {
    const saved = await captureWindow(windows[i], captured.length, privacyClean, selectedTabIds);
    if (saved) captured.push(saved);
  }
  if (!captured.length) throw new Error("No tabs are selected for export.");

  const manifest = api.runtime.getManifest();
  const session = {
    format: WP_CORE.FORMAT,
    formatVersion: WP_CORE.FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    name: String(name || "").trim() || (scope === "all-windows" ? "All-Windows" : "Window"),
    scope,
    generator: { name: "Window Porter", version: manifest.version, platform: currentPlatform() },
    privacyClean: Boolean(privacyClean),
    selection: selectedTabIds ? { mode: "custom", tabCount: selectedTabIds.length } : { mode: "all" },
    windows: captured
  };

  const validation = WP_CORE.validateSession(session);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  return session;
}

function dataUrl(mime, content) {
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

async function downloadText(filename, mime, content) {
  return api.downloads.download({
    url: dataUrl(mime, content),
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });
}

async function exportSession(options = {}) {
  const session = await captureSession(options);
  const base = WP_CORE.buildBaseName(session.name);
  const folder = "WindowPorter";
  const downloads = [];

  downloads.push(await downloadText(`${folder}/${base}.wps.json`, "application/json", `${JSON.stringify(session, null, 2)}\n`));
  if (options.includeTxt !== false) downloads.push(await downloadText(`${folder}/${base}.urls.txt`, "text/plain", WP_CORE.toTxt(session)));
  if (options.includeHtml) downloads.push(await downloadText(`${folder}/${base}.html`, "text/html", WP_CORE.toHtml(session)));

  return { ok: true, counts: WP_CORE.countSession(session), base, downloadIds: downloads };
}

async function safeCreateTab(props, originalUrl, warnings) {
  const lower = String(originalUrl || "").trim().toLowerCase();
  const disallowed = /^(javascript|data|blob):/.test(lower);
  if (disallowed) {
    const fallback = api.runtime.getURL(`blocked.html#${encodeURIComponent(originalUrl || "")}`);
    warnings.push(`Potentially unsafe URL was preserved but not executed: ${originalUrl}`);
    return { tab: await api.tabs.create({ ...props, active: false, pinned: false, url: fallback }), recovered: true };
  }

  try {
    return { tab: await api.tabs.create(props), recovered: false };
  } catch {
    const fallback = api.runtime.getURL(`blocked.html#${encodeURIComponent(originalUrl || "")}`);
    warnings.push(`Could not directly restore "${originalUrl}". A recovery tab was created instead.`);
    return { tab: await api.tabs.create({ ...props, active: false, pinned: false, url: fallback }), recovered: true };
  }
}

function groupMembers(savedWindow, groupId, createdByPosition) {
  return savedWindow.tabs
    .filter((tab) => tab.group === groupId)
    .map((tab) => createdByPosition.get(tab.position))
    .filter(Boolean)
    .map((tab) => tab.id);
}

async function restoreGroups(savedWindow, targetWindowId, createdByPosition, warnings) {
  const report = { requested: (savedWindow.groups || []).length, created: 0, metadata: 0 };
  if (!api.tabs.group) {
    if (report.requested) warnings.push("This browser version does not expose tabs.group(); grouped tabs were restored ungrouped.");
    return report;
  }

  const canUpdateMetadata = Boolean(api.tabGroups && api.tabGroups.update);
  for (const group of savedWindow.groups || []) {
    const tabIds = groupMembers(savedWindow, group.id, createdByPosition);
    if (!tabIds.length) continue;
    try {
      const groupId = await api.tabs.group({ tabIds, createProperties: { windowId: targetWindowId } });
      report.created += 1;
      if (!canUpdateMetadata) {
        warnings.push(`Group "${group.title || group.id}" membership was restored, but title/color/collapsed state are unsupported by this browser build.`);
        continue;
      }
      try {
        await api.tabGroups.update(groupId, {
          title: group.title || "",
          color: WP_CORE.normalizeColor(group.color),
          collapsed: Boolean(group.collapsed)
        });
        report.metadata += 1;
      } catch {
        warnings.push(`Group "${group.title || group.id}" was created, but some visual properties could not be restored.`);
      }
    } catch {
      warnings.push(`Could not recreate group "${group.title || group.id}". Its tabs remain open and ungrouped.`);
    }
  }
  return report;
}

async function restoreMutedStates(savedWindow, createdByPosition, warnings) {
  for (const savedTab of savedWindow.tabs) {
    if (!savedTab.muted) continue;
    const created = createdByPosition.get(savedTab.position);
    if (!created) continue;
    try { await api.tabs.update(created.id, { muted: true }); }
    catch { warnings.push(`Could not restore muted state for "${savedTab.title || savedTab.url}".`); }
  }
}

function validWindowState(state) {
  return ["normal", "minimized", "maximized", "fullscreen"].includes(state) ? state : "normal";
}

async function applyWindowGeometry(savedWindow, targetWindowId, restoreGeometry, warnings) {
  const desiredState = validWindowState(savedWindow.state);
  try {
    if (restoreGeometry && desiredState === "normal" && savedWindow.bounds) {
      const b = savedWindow.bounds;
      const update = { state: "normal" };
      if (Number.isFinite(b.left)) update.left = b.left;
      if (Number.isFinite(b.top)) update.top = b.top;
      if (Number.isFinite(b.width) && b.width >= 200) update.width = b.width;
      if (Number.isFinite(b.height) && b.height >= 150) update.height = b.height;
      await api.windows.update(targetWindowId, update);
    } else if (desiredState !== "normal") {
      await api.windows.update(targetWindowId, { state: desiredState });
    }
  } catch { warnings.push("The saved window size/state could not be fully restored on this display/browser."); }
}

function indexExistingTabs(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    const url = tab.pendingUrl || tab.url;
    if (!url) continue;
    if (!map.has(url)) map.set(url, []);
    map.get(url).push(tab);
  }
  return map;
}

async function restoreIntoWindow(savedWindow, targetWindowId, options, warnings) {
  const append = Boolean(options.append);
  const replace = Boolean(options.replace);
  const restoreGeometry = Boolean(options.restoreGeometry);
  let duplicatePolicy = ["keep", "skip", "focus-existing"].includes(options.duplicatePolicy) ? options.duplicatePolicy : "keep";
  if (replace && duplicatePolicy === "skip") duplicatePolicy = "keep";

  const beforeTabs = await getWindowTabs(targetWindowId);
  const existingByUrl = indexExistingTabs(beforeTabs);
  const oldIds = replace ? beforeTabs.map((t) => t.id) : [];
  const retainedOldIds = new Set();
  const startIndex = append || replace ? beforeTabs.length : 0;
  const createdByPosition = new Map();
  const existingByPosition = new Map();
  let createdCount = 0;
  let reusedCount = 0;
  let skippedCount = 0;
  let recoveryCount = 0;

  for (const savedTab of savedWindow.tabs) {
    const existing = existingByUrl.get(savedTab.url);
    const match = existing && existing.length ? existing.shift() : null;

    if (duplicatePolicy === "skip" && match) {
      skippedCount += 1;
      continue;
    }

    if (duplicatePolicy === "focus-existing" && match) {
      createdByPosition.set(savedTab.position, match);
      existingByPosition.set(savedTab.position, match);
      retainedOldIds.add(match.id);
      reusedCount += 1;
      try {
        if (Boolean(match.pinned) !== Boolean(savedTab.pinned)) await api.tabs.update(match.id, { pinned: Boolean(savedTab.pinned) });
      } catch { warnings.push(`Could not match pinned state for existing tab: ${savedTab.url}`); }
      continue;
    }

    const made = await safeCreateTab({
      windowId: targetWindowId,
      index: startIndex + createdCount,
      active: false,
      pinned: Boolean(savedTab.pinned),
      url: savedTab.url
    }, savedTab.url, warnings);
    createdByPosition.set(savedTab.position, made.tab);
    createdCount += 1;
    if (made.recovered) recoveryCount += 1;
  }

  if (!createdCount && !reusedCount && skippedCount === 0) throw new Error("No tabs were restored.");

  const groupReport = await restoreGroups(savedWindow, targetWindowId, createdByPosition, warnings);
  await restoreMutedStates(savedWindow, createdByPosition, warnings);

  if (replace && oldIds.length) {
    const removable = oldIds.filter((id) => !retainedOldIds.has(id));
    if (removable.length) {
      try { await api.tabs.remove(removable); }
      catch { warnings.push("Some original tabs could not be closed during Replace Current Window."); }
    }
  }

  const activeSaved = savedWindow.tabs.find((tab) => tab.active);
  const activeTab = activeSaved ? createdByPosition.get(activeSaved.position) || existingByPosition.get(activeSaved.position) : null;
  if (activeTab) {
    try { await api.tabs.update(activeTab.id, { active: true }); }
    catch { warnings.push("The saved active tab could not be selected."); }
  }

  await applyWindowGeometry(savedWindow, targetWindowId, restoreGeometry, warnings);
  return { created: createdCount, reused: reusedCount, skipped: skippedCount, recovery: recoveryCount, groupReport };
}

async function createNewTargetWindow() {
  return api.windows.create({ url: "about:blank", focused: false });
}

async function restoreAsNewWindow(savedWindow, options, warnings) {
  const target = await createNewTargetWindow();
  const placeholderTabs = await getWindowTabs(target.id);
  const placeholderIds = placeholderTabs.map((t) => t.id);
  const result = await restoreIntoWindow(savedWindow, target.id, { ...options, append: false, replace: false, duplicatePolicy: "keep" }, warnings);
  if (placeholderIds.length) {
    try { await api.tabs.remove(placeholderIds); } catch { /* harmless extra blank tab */ }
  }
  return { targetWindowId: target.id, ...result };
}

async function restoreSession(session, options = {}) {
  const validation = WP_CORE.validateSession(session);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const startedAt = new Date().toISOString();
  const warnings = [...validation.warnings];
  const mode = ["new-window", "append-current", "replace-current"].includes(options.mode) ? options.mode : "new-window";
  const capabilities = await getCapabilities();
  let currentWindow = null;
  if (mode !== "new-window") currentWindow = await api.windows.getCurrent();

  const totals = { created: 0, reused: 0, skipped: 0, recovery: 0, groupsRequested: 0, groupsCreated: 0, groupMetadata: 0 };

  for (let i = 0; i < session.windows.length; i += 1) {
    const savedWindow = session.windows[i];
    if (savedWindow.incognito) warnings.push(`Saved window ${i + 1} was private/incognito. It is being restored as a normal window without private-session data.`);

    let result;
    if (i === 0 && currentWindow && mode !== "new-window") {
      result = await restoreIntoWindow(savedWindow, currentWindow.id, {
        append: mode === "append-current",
        replace: mode === "replace-current",
        duplicatePolicy: options.duplicatePolicy || "keep",
        restoreGeometry: Boolean(options.restoreGeometry)
      }, warnings);
    } else {
      result = await restoreAsNewWindow(savedWindow, { restoreGeometry: Boolean(options.restoreGeometry) }, warnings);
    }
    totals.created += result.created;
    totals.reused += result.reused;
    totals.skipped += result.skipped;
    totals.recovery += result.recovery;
    totals.groupsRequested += result.groupReport.requested;
    totals.groupsCreated += result.groupReport.created;
    totals.groupMetadata += result.groupReport.metadata;
  }

  const counts = WP_CORE.countSession(session);
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    mode,
    source: session.generator || {},
    target: capabilities,
    requestedTabs: counts.tabs,
    requestedWindows: counts.windows,
    requestedGroups: counts.groups,
    createdTabs: totals.created,
    reusedTabs: totals.reused,
    skippedDuplicates: totals.skipped,
    recoveryTabs: totals.recovery,
    groupsCreated: totals.groupsCreated,
    groupMetadataRestored: totals.groupMetadata,
    warnings
  };

  return { ok: true, report };
}

async function getCurrentSummary() {
  const win = await api.windows.getCurrent();
  const tabs = await getWindowTabs(win.id);
  const groupIds = new Set(tabs.map((t) => t.groupId).filter((id) => Number.isInteger(id) && id !== GROUP_NONE));
  return { tabs: tabs.length, pinned: tabs.filter((t) => t.pinned).length, groups: groupIds.size, incognito: Boolean(win.incognito) };
}

async function getSettings() {
  if (!api.storage || !api.storage.local) return { ...DEFAULT_SETTINGS };
  const stored = await api.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
}

async function updateSettings(next) {
  if (!api.storage || !api.storage.local) throw new Error("Extension-local storage is unavailable in this browser build.");
  const settings = { ...await getSettings(), ...next };
  settings.safetyIntervalMinutes = Math.max(15, Number(settings.safetyIntervalMinutes) || 60);
  settings.safetyKeep = Math.min(10, Math.max(1, Number(settings.safetyKeep) || 5));
  await api.storage.local.set({ [SETTINGS_KEY]: settings });
  await configureSafetyAlarm(settings);
  return settings;
}

async function configureSafetyAlarm(settings = null) {
  if (!api.alarms) return;
  const effective = settings || await getSettings();
  try { await Promise.resolve(api.alarms.clear(SAFETY_ALARM)); } catch { /* ignore */ }
  if (!effective.safetyEnabled) return;
  await Promise.resolve(api.alarms.create(SAFETY_ALARM, { periodInMinutes: effective.safetyIntervalMinutes, delayInMinutes: effective.safetyIntervalMinutes }));
}

async function getSafetySnapshots() {
  if (!api.storage || !api.storage.local) return [];
  const stored = await api.storage.local.get(SNAPSHOTS_KEY);
  return Array.isArray(stored[SNAPSHOTS_KEY]) ? stored[SNAPSHOTS_KEY] : [];
}

async function createSafetySnapshot(reason = "manual") {
  if (!api.storage || !api.storage.local) throw new Error("Extension-local storage is unavailable in this browser build.");
  const settings = await getSettings();
  const session = await captureSession({ scope: "all-windows", name: "Safety Snapshot", privacyClean: false });
  session.safety = { reason, createdAt: new Date().toISOString() };

  let snapshots = await getSafetySnapshots();
  snapshots.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), reason, session });
  snapshots = snapshots.slice(0, settings.safetyKeep);

  try {
    await api.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
  } catch (error) {
    // Quota fallback: keep only the latest snapshot.
    snapshots = snapshots.slice(0, 1);
    await api.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
  }
  return { ok: true, snapshot: snapshots[0], count: snapshots.length };
}

async function safetySummary() {
  const settings = await getSettings();
  const snapshots = await getSafetySnapshots();
  return {
    settings,
    count: snapshots.length,
    latest: snapshots.length ? { id: snapshots[0].id, createdAt: snapshots[0].createdAt, reason: snapshots[0].reason, meta: WP_CORE.sessionMeta(snapshots[0].session) } : null
  };
}

async function getSafetySnapshot(id = null) {
  const snapshots = await getSafetySnapshots();
  if (!snapshots.length) throw new Error("No safety snapshot is available.");
  const found = id ? snapshots.find((item) => item.id === id) : snapshots[0];
  if (!found) throw new Error("Safety snapshot not found.");
  return found;
}

function formatReport(report) {
  const lines = [
    "Window Porter Restore Report",
    "============================",
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Mode: ${report.mode}`,
    `Target: ${report.target.name || report.target.platform} ${report.target.version || ""}`.trim(),
    "",
    `Requested tabs: ${report.requestedTabs}`,
    `Created tabs: ${report.createdTabs}`,
    `Reused existing tabs: ${report.reusedTabs}`,
    `Skipped duplicates: ${report.skippedDuplicates}`,
    `Recovery tabs: ${report.recoveryTabs}`,
    `Requested groups: ${report.requestedGroups}`,
    `Groups created: ${report.groupsCreated}`,
    `Group metadata restored: ${report.groupMetadataRestored}`,
    ""
  ];
  if (report.warnings && report.warnings.length) {
    lines.push(`Warnings (${report.warnings.length})`, "----------------", ...report.warnings.map((w) => `- ${w}`));
  } else {
    lines.push("Warnings: none");
  }
  return `${lines.join("\n")}\n`;
}

function flashBadge(text, title) {
  if (!api.action || !api.action.setBadgeText) return;
  Promise.resolve(api.action.setBadgeText({ text })).catch(() => {});
  if (title && api.action.setTitle) Promise.resolve(api.action.setTitle({ title })).catch(() => {});
  setTimeout(() => {
    Promise.resolve(api.action.setBadgeText({ text: "" })).catch(() => {});
    if (api.action.setTitle) Promise.resolve(api.action.setTitle({ title: "Window Porter" })).catch(() => {});
  }, 3000);
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message && message.type) {
      case "WP_GET_SUMMARY": return { ok: true, summary: await getCurrentSummary() };
      case "WP_GET_STRUCTURE": return { ok: true, structure: await getLiveStructure(message.scope || "current-window") };
      case "WP_GET_CAPABILITIES": return { ok: true, capabilities: await getCapabilities() };
      case "WP_EXPORT": return exportSession(message.options || {});
      case "WP_RESTORE": return restoreSession(message.session, message.options || {});
      case "WP_DOWNLOAD_TEXT": return { ok: true, downloadId: await downloadText(message.filename, message.mime || "text/plain", message.content || "") };
      case "WP_GET_SETTINGS": return { ok: true, settings: await getSettings() };
      case "WP_UPDATE_SETTINGS": return { ok: true, settings: await updateSettings(message.settings || {}) };
      case "WP_GET_SAFETY": return { ok: true, safety: await safetySummary() };
      case "WP_SAFETY_NOW": return createSafetySnapshot("manual");
      case "WP_GET_SAFETY_SESSION": return { ok: true, snapshot: await getSafetySnapshot(message.id || null) };
      case "WP_FORMAT_REPORT": return { ok: true, text: formatReport(message.report || {}) };
      default: throw new Error("Unknown Window Porter request.");
    }
  })().then((result) => sendResponse(result)).catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

if (api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener((command) => {
    if (command !== "snapshot-current-window") return;
    exportSession({ scope: "current-window", name: "Window", privacyClean: false, includeTxt: true, includeHtml: false })
      .then((result) => flashBadge("OK", `Saved ${result.counts.tabs} tabs`))
      .catch((error) => { console.error("Window Porter shortcut export failed:", error); flashBadge("!", "Window Porter save failed"); });
  });
}

if (api.alarms && api.alarms.onAlarm) {
  api.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== SAFETY_ALARM) return;
    createSafetySnapshot("automatic").catch((error) => console.error("Window Porter safety snapshot failed:", error));
  });
}

if (api.runtime && api.runtime.onStartup) {
  api.runtime.onStartup.addListener(() => { configureSafetyAlarm().catch(() => {}); });
}
if (api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(() => { configureSafetyAlarm().catch(() => {}); });
}

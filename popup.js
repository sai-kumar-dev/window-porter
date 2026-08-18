/* global WP_CORE */
"use strict";
const api = typeof browser !== "undefined" ? browser : chrome;

const $ = (id) => document.getElementById(id);
const currentSummary = $("currentSummary");
const sessionName = $("sessionName");
const includeTxt = $("includeTxt");
const includeHtml = $("includeHtml");
const privacyClean = $("privacyClean");
const customSelection = $("customSelection");
const selectionPanel = $("selectionPanel");
const selectionTree = $("selectionTree");
const selectionCount = $("selectionCount");
const saveSearch = $("saveSearch");
const saveFilter = $("saveFilter");
const selectAllButton = $("selectAll");
const clearAllButton = $("clearAll");
const invertSave = $("invertSave");
const toggleDetailsButton = $("toggleDetails");
const saveButton = $("saveButton");

const sessionFile = $("sessionFile");
const fileSummary = $("fileSummary");
const inspectPanel = $("inspectPanel");
const sessionMeta = $("sessionMeta");
const compatibilityBox = $("compatibilityBox");
const restoreBadge = $("restoreBadge");
const restoreSelectionToggle = $("restoreSelectionToggle");
const restoreSearch = $("restoreSearch");
const restoreFilter = $("restoreFilter");
const restoreSelectionCount = $("restoreSelectionCount");
const restoreTree = $("restoreTree");
const restoreAll = $("restoreAll");
const restoreNone = $("restoreNone");
const invertRestore = $("invertRestore");
const toggleRestoreDetails = $("toggleRestoreDetails");
const duplicatePolicy = $("duplicatePolicy");
const restoreGeometry = $("restoreGeometry");
const restoreButton = $("restoreButton");
const exportImportedTxt = $("exportImportedTxt");
const exportImportedHtml = $("exportImportedHtml");

const safetySummaryEl = $("safetySummary");
const safetyEnabled = $("safetyEnabled");
const safetyInterval = $("safetyInterval");
const safetyKeep = $("safetyKeep");
const latestSafety = $("latestSafety");
const snapshotNow = $("snapshotNow");
const restoreLatest = $("restoreLatest");

const reportPanel = $("reportPanel");
const reportSummary = $("reportSummary");
const reportWarnings = $("reportWarnings");
const exportReport = $("exportReport");
const statusBox = $("statusBox");

let importedSession = null;
let importedLabel = "";
let liveStructure = null;
let saveExpanded = true;
let restoreExpanded = true;
let capabilities = null;
let lastReport = null;

function setStatus(text, kind = "") { statusBox.textContent = text; statusBox.className = `status ${kind}`.trim(); }
function clearStatus() { statusBox.textContent = ""; statusBox.className = "status hidden"; }
function selectedValue(name) { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; }
async function send(message) { return api.runtime.sendMessage(message); }
function esc(value) { return WP_CORE.escapeHtml(value); }
function truncate(value, n = 48) { const s = String(value || ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; }

async function refreshSummary() {
  try {
    const response = await send({ type: "WP_GET_SUMMARY" });
    if (!response || !response.ok) throw new Error(response && response.error);
    const s = response.summary;
    currentSummary.textContent = `${s.tabs} tabs · ${s.groups} groups · ${s.pinned} pinned${s.incognito ? " · private window" : ""}`;
  } catch { currentSummary.textContent = "Could not read current window."; }
}

async function loadCapabilities() {
  try {
    const response = await send({ type: "WP_GET_CAPABILITIES" });
    if (response && response.ok) capabilities = response.capabilities;
  } catch { capabilities = null; }
}

function memberIds(el) { return (el.dataset.tabIds || "").split(",").filter(Boolean); }
function saveTabCheckboxById(id) { return selectionTree.querySelector(`input[data-kind="tab"][value="${CSS.escape(String(id))}"]`); }
function saveTabCheckboxes() { return [...selectionTree.querySelectorAll('input[data-kind="tab"]')]; }
function checkedSaveIds() { return saveTabCheckboxes().filter((el) => el.checked).map((el) => Number(el.value)); }

function updateSaveParentStates() {
  const parents = [...selectionTree.querySelectorAll('input[data-kind="group"], input[data-kind="window"]')];
  for (const parent of parents) {
    const members = memberIds(parent).map(saveTabCheckboxById).filter(Boolean);
    const checked = members.filter((el) => el.checked).length;
    parent.checked = members.length > 0 && checked === members.length;
    parent.indeterminate = checked > 0 && checked < members.length;
  }
  const total = saveTabCheckboxes().length;
  const chosen = checkedSaveIds().length;
  const groups = [...selectionTree.querySelectorAll('input[data-kind="group"]')].filter((g) => memberIds(g).some((id) => { const t = saveTabCheckboxById(id); return t && t.checked; })).length;
  selectionCount.textContent = `${chosen} / ${total} tabs · ${groups} groups`;
  saveButton.disabled = customSelection.checked && chosen === 0;
  saveButton.textContent = customSelection.checked ? `Save ${chosen} tab${chosen === 1 ? "" : "s"}` : "Save session";
  applyTreeFilter(selectionTree, saveSearch.value, saveFilter.value);
}

function liveTabRow(tab, grouped) {
  const badges = [tab.pinned ? "PIN" : "", tab.active ? "ACTIVE" : ""].filter(Boolean).join(" · ");
  const searchable = `${tab.title || ""} ${tab.url || ""}`.toLowerCase();
  return `<label class="tree-tab" data-search="${esc(searchable)}" data-pinned="${tab.pinned ? "1" : "0"}" data-grouped="${grouped ? "1" : "0"}">
    <input type="checkbox" data-kind="tab" value="${tab.id}" checked>
    <span class="tree-tab-text"><span class="tree-title">${esc(tab.title || tab.url)}${badges ? `<span class="tree-badge">${badges}</span>` : ""}</span><span class="tree-url">${esc(tab.url)}</span></span>
  </label>`;
}

function renderSaveTree() {
  if (!liveStructure) { selectionTree.innerHTML = '<div class="empty-group">Unable to load tabs.</div>'; return; }
  const chunks = [];
  for (const win of liveStructure.windows) {
    const tabs = win.tabs;
    const windowIds = tabs.map((t) => t.id).join(",");
    const groupedIds = new Set(win.groups.flatMap((g) => g.tabIds));
    const ungrouped = tabs.filter((t) => !groupedIds.has(t.id));
    const windowLabel = `${win.focused ? "Current" : `Window ${win.ordinal + 1}`} · ${tabs.length} tabs${win.incognito ? " · private" : ""}`;
    chunks.push(`<details class="tree-window" open><summary><input type="checkbox" data-kind="window" data-tab-ids="${windowIds}" checked> ${esc(windowLabel)}</summary>`);
    for (const group of win.groups) {
      const members = tabs.filter((t) => group.tabIds.includes(t.id));
      const ids = members.map((t) => t.id).join(",");
      chunks.push(`<details class="tree-group" open><summary><input type="checkbox" data-kind="group" data-tab-ids="${ids}" checked> ${esc(group.title || "Unnamed group")} <span class="tree-badge">${members.length} · ${esc(group.color)}</span></summary><div class="tree-tabs">${members.map((t) => liveTabRow(t, true)).join("")}</div></details>`);
    }
    if (ungrouped.length) {
      const ids = ungrouped.map((t) => t.id).join(",");
      chunks.push(`<details class="tree-group" open><summary><input type="checkbox" data-kind="group" data-tab-ids="${ids}" checked> Ungrouped <span class="tree-badge">${ungrouped.length}</span></summary><div class="tree-tabs">${ungrouped.map((t) => liveTabRow(t, false)).join("")}</div></details>`);
    }
    chunks.push("</details>");
  }
  selectionTree.innerHTML = chunks.join("");
  updateSaveParentStates();
}

async function loadSelectionStructure() {
  selectionCount.textContent = "Loading…";
  selectionTree.innerHTML = '<div class="empty-group">Reading open tabs…</div>';
  try {
    const response = await send({ type: "WP_GET_STRUCTURE", scope: selectedValue("scope") });
    if (!response || !response.ok) throw new Error(response && response.error || "Could not inspect tabs.");
    liveStructure = response.structure;
    renderSaveTree();
  } catch (error) {
    liveStructure = null;
    selectionTree.innerHTML = `<div class="empty-group">${esc(error.message || String(error))}</div>`;
    selectionCount.textContent = "Unavailable";
  }
}

function applyTreeFilter(root, query, filter) {
  const q = String(query || "").trim().toLowerCase();
  const tabs = [...root.querySelectorAll(".tree-tab")];
  for (const row of tabs) {
    const checkbox = row.querySelector('input[data-kind="tab"]');
    const matchText = !q || (row.dataset.search || "").includes(q);
    let matchFilter = true;
    if (filter === "pinned") matchFilter = row.dataset.pinned === "1";
    if (filter === "grouped") matchFilter = row.dataset.grouped === "1";
    if (filter === "ungrouped") matchFilter = row.dataset.grouped === "0";
    if (filter === "selected") matchFilter = Boolean(checkbox && checkbox.checked);
    row.classList.toggle("filtered-out", !(matchText && matchFilter));
  }
  for (const group of root.querySelectorAll(".tree-group")) {
    const visible = [...group.querySelectorAll(":scope > .tree-tabs > .tree-tab")].some((r) => !r.classList.contains("filtered-out"));
    group.classList.toggle("filtered-out", !visible);
  }
  for (const win of root.querySelectorAll(".tree-window")) {
    const visible = [...win.querySelectorAll(":scope > .tree-group")].some((g) => !g.classList.contains("filtered-out"));
    win.classList.toggle("filtered-out", !visible);
  }
}

customSelection.addEventListener("change", async () => {
  selectionPanel.classList.toggle("hidden", !customSelection.checked);
  saveButton.disabled = false;
  if (customSelection.checked) await loadSelectionStructure();
  else saveButton.textContent = "Save session";
});
document.querySelectorAll('input[name="scope"]').forEach((radio) => radio.addEventListener("change", () => { if (customSelection.checked) loadSelectionStructure(); }));
selectionTree.addEventListener("click", (event) => { if (event.target && event.target.matches('input[type="checkbox"]')) event.stopPropagation(); });
selectionTree.addEventListener("change", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.dataset.kind === "window" || el.dataset.kind === "group") {
    for (const id of memberIds(el)) { const tab = saveTabCheckboxById(id); if (tab) tab.checked = el.checked; }
  }
  updateSaveParentStates();
});
selectAllButton.addEventListener("click", () => { saveTabCheckboxes().forEach((el) => { el.checked = true; }); updateSaveParentStates(); });
clearAllButton.addEventListener("click", () => { saveTabCheckboxes().forEach((el) => { el.checked = false; }); updateSaveParentStates(); });
invertSave.addEventListener("click", () => { saveTabCheckboxes().forEach((el) => { el.checked = !el.checked; }); updateSaveParentStates(); });
toggleDetailsButton.addEventListener("click", () => { saveExpanded = !saveExpanded; selectionTree.querySelectorAll("details").forEach((d) => { d.open = saveExpanded; }); toggleDetailsButton.textContent = saveExpanded ? "Collapse" : "Expand"; });
saveSearch.addEventListener("input", () => applyTreeFilter(selectionTree, saveSearch.value, saveFilter.value));
saveFilter.addEventListener("change", () => applyTreeFilter(selectionTree, saveSearch.value, saveFilter.value));

saveButton.addEventListener("click", async () => {
  clearStatus();
  saveButton.disabled = true;
  const oldText = saveButton.textContent;
  saveButton.textContent = "Saving…";
  try {
    const selectedTabIds = customSelection.checked ? checkedSaveIds() : null;
    if (customSelection.checked && !selectedTabIds.length) throw new Error("Select at least one tab.");
    const response = await send({ type: "WP_EXPORT", options: {
      scope: selectedValue("scope"), name: sessionName.value.trim(), includeTxt: includeTxt.checked, includeHtml: includeHtml.checked,
      privacyClean: privacyClean.checked, selectedTabIds
    }});
    if (!response || !response.ok) throw new Error(response && response.error || "Save failed.");
    const c = response.counts;
    setStatus(`Saved ${c.tabs} tabs from ${c.windows} window${c.windows === 1 ? "" : "s"}.\nDownloads/WindowPorter/${response.base}…`, "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
  finally { saveButton.disabled = customSelection.checked && checkedSaveIds().length === 0; saveButton.textContent = customSelection.checked ? oldText : "Save session"; updateSaveParentStates(); }
});

function restoreRefCheckbox(ref) { return restoreTree.querySelector(`input[data-kind="tab"][data-ref="${CSS.escape(ref)}"]`); }
function restoreTabCheckboxes() { return [...restoreTree.querySelectorAll('input[data-kind="tab"]')]; }
function checkedRestoreRefs() { return restoreTabCheckboxes().filter((el) => el.checked).map((el) => el.dataset.ref); }
function restoreMemberRefs(el) { return (el.dataset.tabRefs || "").split("|").filter(Boolean); }

function importedTabRow(tab, wi, grouped) {
  const ref = WP_CORE.tabRef(wi, tab.position);
  const badges = [tab.pinned ? "PIN" : "", tab.active ? "ACTIVE" : "", tab.muted ? "MUTED" : ""].filter(Boolean).join(" · ");
  const searchable = `${tab.title || ""} ${tab.url || ""}`.toLowerCase();
  return `<label class="tree-tab" data-search="${esc(searchable)}" data-pinned="${tab.pinned ? "1" : "0"}" data-grouped="${grouped ? "1" : "0"}">
    <input type="checkbox" data-kind="tab" data-ref="${esc(ref)}" checked>
    <span class="tree-tab-text"><span class="tree-title">${esc(tab.title || tab.url)}${badges ? `<span class="tree-badge">${badges}</span>` : ""}</span><span class="tree-url">${esc(tab.url)}</span></span>
  </label>`;
}

function renderRestoreTree() {
  if (!importedSession) { restoreTree.innerHTML = ""; return; }
  const chunks = [];
  importedSession.windows.forEach((win, wi) => {
    const refs = win.tabs.map((t) => WP_CORE.tabRef(wi, t.position));
    const groupMap = new Map((win.groups || []).map((g) => [g.id, g]));
    const grouped = new Map();
    const ungrouped = [];
    for (const tab of win.tabs) {
      if (tab.group && groupMap.has(tab.group)) {
        if (!grouped.has(tab.group)) grouped.set(tab.group, []);
        grouped.get(tab.group).push(tab);
      } else ungrouped.push(tab);
    }
    chunks.push(`<details class="tree-window" open><summary><input type="checkbox" data-kind="window" data-tab-refs="${refs.join("|")}" checked> Window ${wi + 1} · ${win.tabs.length} tabs</summary>`);
    for (const [groupId, members] of grouped.entries()) {
      const group = groupMap.get(groupId);
      const memberRefs = members.map((t) => WP_CORE.tabRef(wi, t.position));
      chunks.push(`<details class="tree-group" open><summary><input type="checkbox" data-kind="group" data-tab-refs="${memberRefs.join("|")}" checked> ${esc(group.title || group.id)} <span class="tree-badge">${members.length} · ${esc(group.color || "grey")}</span></summary><div class="tree-tabs">${members.map((t) => importedTabRow(t, wi, true)).join("")}</div></details>`);
    }
    if (ungrouped.length) {
      const memberRefs = ungrouped.map((t) => WP_CORE.tabRef(wi, t.position));
      chunks.push(`<details class="tree-group" open><summary><input type="checkbox" data-kind="group" data-tab-refs="${memberRefs.join("|")}" checked> Ungrouped <span class="tree-badge">${ungrouped.length}</span></summary><div class="tree-tabs">${ungrouped.map((t) => importedTabRow(t, wi, false)).join("")}</div></details>`);
    }
    chunks.push("</details>");
  });
  restoreTree.innerHTML = chunks.join("");
  restoreTree.classList.toggle("selection-disabled", !restoreSelectionToggle.checked);
  updateRestoreParentStates();
}

function updateRestoreParentStates() {
  for (const parent of restoreTree.querySelectorAll('input[data-kind="group"], input[data-kind="window"]')) {
    const members = restoreMemberRefs(parent).map(restoreRefCheckbox).filter(Boolean);
    const checked = members.filter((el) => el.checked).length;
    parent.checked = members.length > 0 && checked === members.length;
    parent.indeterminate = checked > 0 && checked < members.length;
  }
  const total = restoreTabCheckboxes().length;
  const chosen = restoreSelectionToggle.checked ? checkedRestoreRefs().length : total;
  restoreSelectionCount.textContent = `${chosen} / ${total} tabs selected`;
  restoreButton.disabled = !importedSession || chosen === 0;
  restoreButton.textContent = importedSession ? `Restore ${chosen} tab${chosen === 1 ? "" : "s"}` : "Restore session";
  applyTreeFilter(restoreTree, restoreSearch.value, restoreFilter.value);
}

function renderSessionMeta() {
  const meta = WP_CORE.sessionMeta(importedSession);
  sessionMeta.innerHTML = [
    [meta.tabs, "Tabs"], [meta.windows, "Windows"], [meta.groups, "Groups"], [meta.pinned, "Pinned"]
  ].map(([value, label]) => `<div class="meta-item"><strong>${esc(value)}</strong><span>${label}</span></div>`).join("");

  restoreBadge.textContent = truncate(importedLabel || meta.name, 24);
  const source = `${meta.sourcePlatform}${meta.sourceVersion !== "unknown" ? ` · WP ${meta.sourceVersion}` : ""}`;
  const created = meta.createdAt ? new Date(meta.createdAt).toLocaleString() : "unknown time";
  fileSummary.textContent = `${importedLabel || meta.name} · ${meta.tabs} tabs · ${meta.groups} groups · ${source} · ${created}`;
}

function renderCompatibility() {
  if (!importedSession) return;
  const counts = WP_CORE.countSession(importedSession);
  if (!capabilities) {
    compatibilityBox.textContent = "Target-browser capability check unavailable. Restore will still use graceful fallbacks.";
    return;
  }
  const lines = [];
  lines.push(`<strong>Target:</strong> ${esc(capabilities.name || capabilities.platform)} ${esc(capabilities.version || "")}`);
  if (counts.groups === 0) lines.push("✓ No tab-group compatibility requirement.");
  else if (capabilities.groupMetadata) lines.push(`✓ Full tab-group membership + title/color/collapsed metadata available for ${counts.groups} saved groups.`);
  else if (capabilities.groupMembership) lines.push(`⚠ Group membership available, but some group metadata may be flattened.`);
  else lines.push(`⚠ ${counts.groups} saved groups will be flattened; URLs/order still restore.`);
  lines.push(capabilities.windowGeometry ? "✓ Window state/geometry API available." : "⚠ Window geometry restore unavailable.");
  lines.push("✓ URLs, order, pinned state, and active-tab reconstruction are supported by the core tab APIs.");
  compatibilityBox.innerHTML = lines.join("<br>");
}

function setImportedSession(session, label) {
  importedSession = session;
  importedLabel = label || session.name || "Imported session";
  inspectPanel.classList.remove("hidden");
  restoreSelectionToggle.checked = false;
  renderSessionMeta();
  renderCompatibility();
  renderRestoreTree();
  restoreButton.disabled = false;
  clearStatus();
}

sessionFile.addEventListener("change", async () => {
  importedSession = null;
  inspectPanel.classList.add("hidden");
  restoreButton.disabled = true;
  const file = sessionFile.files && sessionFile.files[0];
  if (!file) { fileSummary.textContent = "Nothing selected"; restoreBadge.textContent = "no file"; return; }
  try {
    const text = await file.text();
    const parsed = WP_CORE.parseImportedFile(file.name, text);
    const validation = WP_CORE.validateSession(parsed);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    setImportedSession(parsed, file.name);
    if (validation.counts.tabs > 500) setStatus(`Large session: ${validation.counts.tabs} tabs. Window Porter will require confirmation before restoring.`, "");
  } catch (error) {
    fileSummary.textContent = `${file.name} · invalid`;
    restoreBadge.textContent = "invalid";
    setStatus(error.message || String(error), "error");
  }
});

restoreTree.addEventListener("click", (event) => { if (event.target && event.target.matches('input[type="checkbox"]')) event.stopPropagation(); });
restoreTree.addEventListener("change", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement) || !restoreSelectionToggle.checked) return;
  if (el.dataset.kind === "window" || el.dataset.kind === "group") {
    for (const ref of restoreMemberRefs(el)) { const tab = restoreRefCheckbox(ref); if (tab) tab.checked = el.checked; }
  }
  updateRestoreParentStates();
});
restoreSelectionToggle.addEventListener("change", () => { restoreTree.classList.toggle("selection-disabled", !restoreSelectionToggle.checked); updateRestoreParentStates(); });
restoreAll.addEventListener("click", () => { if (!restoreSelectionToggle.checked) return; restoreTabCheckboxes().forEach((el) => { el.checked = true; }); updateRestoreParentStates(); });
restoreNone.addEventListener("click", () => { if (!restoreSelectionToggle.checked) return; restoreTabCheckboxes().forEach((el) => { el.checked = false; }); updateRestoreParentStates(); });
invertRestore.addEventListener("click", () => { if (!restoreSelectionToggle.checked) return; restoreTabCheckboxes().forEach((el) => { el.checked = !el.checked; }); updateRestoreParentStates(); });
toggleRestoreDetails.addEventListener("click", () => { restoreExpanded = !restoreExpanded; restoreTree.querySelectorAll("details").forEach((d) => { d.open = restoreExpanded; }); toggleRestoreDetails.textContent = restoreExpanded ? "Collapse" : "Expand"; });
restoreSearch.addEventListener("input", () => applyTreeFilter(restoreTree, restoreSearch.value, restoreFilter.value));
restoreFilter.addEventListener("change", () => applyTreeFilter(restoreTree, restoreSearch.value, restoreFilter.value));

function sessionForCurrentRestoreSelection() {
  if (!importedSession) throw new Error("No session selected.");
  if (!restoreSelectionToggle.checked) return importedSession;
  return WP_CORE.subsetSession(importedSession, checkedRestoreRefs());
}

async function downloadImported(kind) {
  const session = sessionForCurrentRestoreSelection();
  const base = WP_CORE.buildBaseName(`${session.name || "Imported"}-selected`);
  const isTxt = kind === "txt";
  const response = await send({
    type: "WP_DOWNLOAD_TEXT",
    filename: `WindowPorter/${base}.${isTxt ? "urls.txt" : "html"}`,
    mime: isTxt ? "text/plain" : "text/html",
    content: isTxt ? WP_CORE.toTxt(session) : WP_CORE.toHtml(session)
  });
  if (!response || !response.ok) throw new Error(response && response.error || "Download failed.");
}
exportImportedTxt.addEventListener("click", () => downloadImported("txt").then(() => setStatus("Exported imported session as TXT.", "success")).catch((e) => setStatus(e.message, "error")));
exportImportedHtml.addEventListener("click", () => downloadImported("html").then(() => setStatus("Exported imported session as HTML.", "success")).catch((e) => setStatus(e.message, "error")));

document.querySelectorAll('input[name="restoreMode"]').forEach((radio) => radio.addEventListener("change", () => {
  const mode = selectedValue("restoreMode");
  duplicatePolicy.disabled = mode === "new-window";
  if (mode === "new-window") duplicatePolicy.value = "keep";
}));

restoreButton.addEventListener("click", async () => {
  if (!importedSession) return;
  clearStatus();
  let session;
  try { session = sessionForCurrentRestoreSelection(); }
  catch (error) { setStatus(error.message, "error"); return; }
  const validation = WP_CORE.validateSession(session);
  if (!validation.ok) { setStatus(validation.errors.join(" "), "error"); return; }
  const mode = selectedValue("restoreMode");
  const counts = validation.counts;
  if (counts.tabs > 500 && !confirm(`This selection contains ${counts.tabs} tabs. Restore them now?`)) return;
  if (mode === "replace-current" && !confirm("Replace Current Window will close current tabs after replacement tabs are safely created/reused. Continue?")) return;

  restoreButton.disabled = true;
  const oldText = restoreButton.textContent;
  restoreButton.textContent = "Restoring…";
  try {
    const response = await send({ type: "WP_RESTORE", session, options: { mode, duplicatePolicy: duplicatePolicy.value, restoreGeometry: restoreGeometry.checked } });
    if (!response || !response.ok) throw new Error(response && response.error || "Restore failed.");
    lastReport = response.report;
    renderReport(lastReport);
    setStatus(`Restore complete: ${lastReport.createdTabs} created, ${lastReport.reusedTabs} reused, ${lastReport.skippedDuplicates} skipped.${lastReport.warnings.length ? ` ${lastReport.warnings.length} warning(s).` : ""}`, "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
  finally { restoreButton.disabled = false; restoreButton.textContent = oldText; updateRestoreParentStates(); }
});

function renderReport(report) {
  reportPanel.classList.remove("hidden");
  const cells = [
    [report.requestedTabs, "Requested"], [report.createdTabs, "Created"], [report.reusedTabs, "Reused"], [report.skippedDuplicates, "Skipped"],
    [report.recoveryTabs, "Recovery tabs"], [report.requestedGroups, "Groups requested"], [report.groupsCreated, "Groups created"], [report.groupMetadataRestored, "Group metadata"]
  ];
  reportSummary.innerHTML = cells.map(([v, l]) => `<div class="report-item"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("");
  reportWarnings.innerHTML = report.warnings && report.warnings.length ? `<strong>Warnings (${report.warnings.length})</strong><ul>${report.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "No warnings. Restore matched the available target-browser capabilities.";
}

exportReport.addEventListener("click", async () => {
  if (!lastReport) return;
  try {
    const formatted = await send({ type: "WP_FORMAT_REPORT", report: lastReport });
    if (!formatted || !formatted.ok) throw new Error(formatted && formatted.error || "Could not format report.");
    const name = `WindowPorter/Restore-Report__${WP_CORE.localTimestamp(new Date())}.txt`;
    const response = await send({ type: "WP_DOWNLOAD_TEXT", filename: name, mime: "text/plain", content: formatted.text });
    if (!response || !response.ok) throw new Error(response && response.error || "Could not export report.");
    setStatus("Restore report exported.", "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
});

async function loadSafety() {
  try {
    const response = await send({ type: "WP_GET_SAFETY" });
    if (!response || !response.ok) throw new Error(response && response.error);
    const safety = response.safety;
    safetyEnabled.checked = Boolean(safety.settings.safetyEnabled);
    safetyInterval.value = String(safety.settings.safetyIntervalMinutes || 60);
    safetyKeep.value = String(safety.settings.safetyKeep || 5);
    safetySummaryEl.textContent = safety.settings.safetyEnabled ? `On · every ${safety.settings.safetyIntervalMinutes}m` : "Off";
    if (safety.latest) {
      latestSafety.innerHTML = `<strong>Latest:</strong> ${esc(new Date(safety.latest.createdAt).toLocaleString())}<br>${safety.latest.meta.tabs} tabs · ${safety.latest.meta.windows} windows · ${safety.latest.meta.groups} groups · ${esc(safety.latest.reason)}`;
      restoreLatest.disabled = false;
    } else {
      latestSafety.textContent = "No safety snapshot yet.";
      restoreLatest.disabled = true;
    }
  } catch {
    safetySummaryEl.textContent = "Unavailable";
    latestSafety.textContent = "Safety snapshots are unavailable in this browser build.";
  }
}

async function saveSafetySettings() {
  const response = await send({ type: "WP_UPDATE_SETTINGS", settings: {
    safetyEnabled: safetyEnabled.checked,
    safetyIntervalMinutes: Number(safetyInterval.value),
    safetyKeep: Number(safetyKeep.value)
  }});
  if (!response || !response.ok) throw new Error(response && response.error || "Could not save safety settings.");
  await loadSafety();
}
[safetyEnabled, safetyInterval, safetyKeep].forEach((el) => el.addEventListener("change", () => saveSafetySettings().catch((e) => setStatus(e.message, "error"))));

snapshotNow.addEventListener("click", async () => {
  snapshotNow.disabled = true;
  snapshotNow.textContent = "Saving…";
  try {
    const response = await send({ type: "WP_SAFETY_NOW" });
    if (!response || !response.ok) throw new Error(response && response.error || "Safety snapshot failed.");
    await loadSafety();
    setStatus("Local safety snapshot saved.", "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
  finally { snapshotNow.disabled = false; snapshotNow.textContent = "Snapshot now"; }
});

restoreLatest.addEventListener("click", async () => {
  try {
    const response = await send({ type: "WP_GET_SAFETY_SESSION" });
    if (!response || !response.ok) throw new Error(response && response.error || "No safety snapshot available.");
    setImportedSession(response.snapshot.session, `Safety snapshot · ${new Date(response.snapshot.createdAt).toLocaleString()}`);
    setStatus("Latest safety snapshot loaded into Inspect & Restore. Nothing has been restored yet.", "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
});

(async function init() {
  await Promise.all([refreshSummary(), loadCapabilities(), loadSafety()]);
  duplicatePolicy.disabled = true;
})();

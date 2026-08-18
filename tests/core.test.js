const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const corePath = path.join(__dirname, "..", "core.js");
vm.runInThisContext(fs.readFileSync(corePath, "utf8"), { filename: corePath });

assert.strictEqual(WP_CORE.FORMAT, "windowporter");
assert.strictEqual(WP_CORE.FORMAT_VERSION, 1);

const txtSession = WP_CORE.sessionFromTxt("https://example.com/a\n\n# comment\nhttps://example.com/b\n", "Test");
assert.strictEqual(txtSession.windows.length, 1);
assert.strictEqual(txtSession.windows[0].tabs.length, 2);
assert.strictEqual(txtSession.windows[0].tabs[0].active, true);
assert.strictEqual(WP_CORE.validateSession(txtSession).ok, true);
assert.deepStrictEqual(WP_CORE.countSession(txtSession), { windows: 1, tabs: 2, groups: 0, pinned: 0 });

const grouped = {
  format: "windowporter",
  formatVersion: 1,
  createdAt: new Date().toISOString(),
  name: "Grouped",
  generator: { name: "Window Porter", version: "0.3.0", platform: "test" },
  windows: [{
    ordinal: 0, state: "normal", focused: true, incognito: false, bounds: null,
    groups: [{ id: "g1", title: "Research", color: "blue", collapsed: false, firstPosition: 0 }],
    tabs: [
      { position: 0, url: "https://a.test", title: "A", pinned: false, active: true, muted: false, group: "g1" },
      { position: 1, url: "https://b.test", title: "B", pinned: true, active: false, muted: false, group: "g1" },
      { position: 2, url: "https://c.test", title: "C", pinned: false, active: false, muted: false, group: null }
    ]
  }]
};
assert.strictEqual(WP_CORE.validateSession(grouped).ok, true);
const subset = WP_CORE.subsetSession(grouped, [WP_CORE.tabRef(0, 1), WP_CORE.tabRef(0, 2)]);
assert.strictEqual(subset.windows.length, 1);
assert.strictEqual(subset.windows[0].tabs.length, 2);
assert.strictEqual(subset.windows[0].tabs[0].position, 0);
assert.strictEqual(subset.windows[0].tabs[0].url, "https://b.test");
assert.strictEqual(subset.windows[0].tabs[0].group, "g1");
assert.strictEqual(subset.windows[0].groups.length, 1);
assert.strictEqual(subset.windows[0].tabs.filter(t => t.active).length, 1);
assert.strictEqual(WP_CORE.validateSession(subset).ok, true);

const noGroupSubset = WP_CORE.subsetSession(grouped, [WP_CORE.tabRef(0, 2)]);
assert.strictEqual(noGroupSubset.windows[0].groups.length, 0);
assert.strictEqual(noGroupSubset.windows[0].tabs[0].group, null);
assert.strictEqual(noGroupSubset.windows[0].tabs[0].active, true);

const cleaned = WP_CORE.sanitizeUrl("https://example.com/path?utm_source=x&keep=yes&access_token=secret#fbclid=x&section=2");
assert.ok(!cleaned.includes("utm_source"));
assert.ok(!cleaned.includes("access_token"));
assert.ok(!cleaned.includes("fbclid"));
assert.ok(cleaned.includes("keep=yes"));
assert.ok(cleaned.includes("section=2"));

assert.strictEqual(WP_CORE.toTxt(txtSession), "https://example.com/a\nhttps://example.com/b\n");
assert.ok(WP_CORE.toHtml(txtSession).includes("Window Porter WPS v1"));
assert.strictEqual(WP_CORE.validateSession({ format: "bad", formatVersion: 1, windows: [] }).ok, false);

const meta = WP_CORE.sessionMeta(grouped);
assert.strictEqual(meta.tabs, 3);
assert.strictEqual(meta.groups, 1);
assert.strictEqual(meta.pinned, 1);

console.log("Window Porter core tests: PASS");

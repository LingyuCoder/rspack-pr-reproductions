import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

// This checks saved observations, not a fresh watcher execution. To reproduce
// against real binaries, regenerate them with capture.mjs first (see README).
const captures = Object.fromEntries(["pr", "base", "watchpack"].map(label => {
  const capture = JSON.parse(readFileSync(new URL(`results/${label}.json`, import.meta.url), "utf8"));
  assert.equal(capture.label, label);
  assert.equal(capture.results.length, 3);
  if (label !== "watchpack") {
    assert.match(capture.bindingSha256, /^[a-f0-9]{64}$/);
    assert.match(capture.bindingSourceSha, /^[a-f0-9]{40}$/);
  } else {
    assert.equal(capture.version, "2.6.3");
  }
  return [label, capture];
}));
const result = (label, name) => {
  const found = captures[label].results.find(item => item.case === name);
  assert.ok(found, `${label}/${name}: captured case exists`);
  return found;
};
const hasEvent = (item, kind, file) => item.events.some(event => event.kind === kind && event.path === file);
const table = [];
for (const label of ["base", "pr", "watchpack"]) {
  const initial = result(label, "initial-missing-nested");
  assert.deepEqual(initial.directories, ["src", "src/child"]);
  assert.equal(initial.childExistedAtWatch, false);
  assert.equal(initial.filesystemMutationAfterWatch, null);
  assert.deepEqual(initial.removedFiles, label === "pr" ? [] : ["src/child"]);
  assert.deepEqual(initial.changedFiles, label === "watchpack" ? [] : ["src"]);
  assert.equal(hasEvent(initial, "remove", "src/child"), label !== "pr");
  if (label === "pr") {
    assert.ok(initial.events.some(event => event.kind === "change"
      && event.path === "src/child" && event.mtime === null));
  }

  const standalone = result(label, "initial-missing-standalone");
  assert.deepEqual(standalone.directories, ["src/child"]);
  assert.equal(standalone.childExistedAtWatch, false);
  assert.equal(standalone.filesystemMutationAfterWatch, null);
  assert.deepEqual(standalone.changedFiles, []);
  assert.deepEqual(standalone.removedFiles, ["src/child"]);
  assert.ok(hasEvent(standalone, "remove", "src/child"));

  const live = result(label, "live-removal-nested");
  assert.equal(live.childExistedAtWatch, true);
  assert.equal(live.filesystemMutationAfterWatch, "rmdir(src/child)");
  assert.deepEqual(live.changedFiles, ["src"]);
  assert.deepEqual(live.removedFiles, label === "base" ? ["src/child"] : []);
  if (label !== "base") {
    assert.ok(!hasEvent(live, "remove", "src/child"));
    assert.ok(live.events.some(event => event.kind === "change"
      && event.path === "src/child" && event.mtime === null));
  }
  for (const item of [initial, standalone, live]) {
    table.push({ implementation: label, case: item.case,
      changedFiles: item.changedFiles.join(", "), removedFiles: item.removedFiles.join(", ") });
  }
}
console.table(table);
console.log("Confirmed in saved captures: PR loses the initial missing nested-context removal; standalone missing still works; live deletion matches Watchpack.");
writeFileSync(new URL("results/verification.json", import.meta.url), JSON.stringify({
  node: process.version, platform: process.platform, arch: process.arch,
  mode: "saved-capture-verification", confirmed: true, results: table,
}, null, 2) + "\n");

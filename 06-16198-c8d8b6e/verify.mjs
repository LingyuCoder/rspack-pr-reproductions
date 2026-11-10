import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
for (const [label, recovers] of [
  ["base", true], ["pr", false], ["webpack", true], ["webpack-release", false],
]) {
  const entry = await require("./dist/" + label + "/bundle.cjs");
  assert.equal(entry.current(), 0);
  const observed = [];
  for (let i = 0; i < 2; i++) {
    let error = null;
    try {
      const ids = await entry.update();
      assert.ok(ids?.length, "expected a real hot update");
    } catch (e) { error = e.message; }
    observed.push({ error, ...entry.state() });
  }
  const handled = "handled: render failed";
  assert.deepEqual(observed, recovers ? [
    { error: null, status: "idle", events: [handled] },
    { error: null, status: "idle", events: [handled, "accepted"] },
  ] : [
    { error: "render failed", status: "apply", events: [] },
    { error: "check() is only allowed in idle status", status: "apply", events: [] },
  ], label);
  console.log(label + ": " + observed.map(o => [o.status, o.error || o.events.at(-1)].join(": ")).join(" -> "));
}

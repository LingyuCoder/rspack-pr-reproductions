import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
for (const label of ["base", "pr"]) {
  const entry = require("./dist/" + label + "/bundle.cjs");
  if (label === "base") {
    assert.deepEqual(await entry.update(), ["./dep.js"]);
    assert.equal(await entry.getLazy(), 2);
    assert.equal(entry.status(), "idle");
    console.log("base: update succeeds; lazy chunk exports 2; status idle");
  } else {
    const matches = { name: "ChunkLoadError", message: /lazy timed out waiting for HMR \(status: apply\)/ };
    await assert.rejects(entry.update(), matches);
    await assert.rejects(entry.getLazy(), matches);
    assert.equal(entry.status(), "apply");
    console.log("pr: update and import both time out waiting for HMR; status apply");
  }
}

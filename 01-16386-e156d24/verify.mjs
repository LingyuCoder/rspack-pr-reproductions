import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const results = [];
for (const [name, expectedExit, expectedAwaitCount] of [
  ["base-split", 0, 1],
  ["pr-split", 1, 2],
  ["pr-inline", 0, 1],
  ["pr-split-no-tla", 0, 1],
  ["pr-split-single-await", 0, 1],
]) {
  const directory = new URL(`./dist/${name}/`, import.meta.url);
  const source = readFileSync(new URL("main.mjs", directory), "utf8");
  const awaitCount = [...source.matchAll(/\b(__webpack_exports__)\s*=\s*await\s+\1\s*;/g)].length;
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("consumer.mjs", directory))], {
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(run.status, expectedExit, `${name}: ${run.stderr}`);
  assert.equal(awaitCount, expectedAwaitCount, name);
  if (expectedExit === 0) assert.equal(run.stdout.trim(), "value=42", name);
  else assert.match(run.stderr, /Error: unexpected then/, name);
  results.push({ case: name, awaitCount, exitCode: run.status,
    outcome: expectedExit === 0 ? run.stdout.trim() : "Error: unexpected then" });
}
console.table(results);
writeFileSync(new URL("./results/verification.json", import.meta.url), JSON.stringify({
  node: process.version, platform: process.platform, arch: process.arch, results,
}, null, 2) + "\n");

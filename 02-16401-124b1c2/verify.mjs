import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const results = [];
for (const [name, input, expectedStdout] of [
  ["native", "entry.cjs", "value=42\nowns=true"],
  ["base-mangle", "dist/base-mangle/main.cjs", "value=42\nowns=false"],
  ["base-no-mangle", "dist/base-no-mangle/main.cjs", "value=42\nowns=true"],
  ["pr-mangle", "dist/pr-mangle/main.cjs", "value=undefined\nowns=true"],
  ["pr-no-mangle", "dist/pr-no-mangle/main.cjs", "value=42\nowns=true"],
  ["webpack-mangle", "dist/webpack-mangle/main.cjs", "value=42\nowns=true"],
  ["webpack-no-mangle", "dist/webpack-no-mangle/main.cjs", "value=42\nowns=true"],
]) {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(input, import.meta.url))], {
    encoding: "utf8", timeout: 5000,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `${name}: ${run.stderr}`);
  assert.equal(run.stderr, "", name);
  assert.equal(run.stdout.trim(), expectedStdout, name);
  results.push({ case: name, exitCode: run.status, stdout: run.stdout.trim() });
}

// Check the emitted mismatch as well as its observable runtime consequence.
const pr = readFileSync(new URL("dist/pr-mangle/main.cjs", import.meta.url), "utf8");
assert.match(pr, /module\.exports = \{"longProperty":42\}/);
assert.match(pr, /\/\* \.data\.longProperty \*\/\.p\.s/);

console.table(results);
writeFileSync(new URL("results/verification.json", import.meta.url), JSON.stringify({
  node: process.version, platform: process.platform, arch: process.arch, results,
}, null, 2) + "\n");

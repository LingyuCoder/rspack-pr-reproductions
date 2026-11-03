import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fullArray = [11, 22, 33, 44, 55];
const results = [];
for (const [name, entry, expectedArray, expectedOutput] of [
  ["base-multi", "a", [0], "mapped=0"],
  ["base-multi", "b", [11], "first=11"],
  ["base-b-only", "b", [11], "first=11"],
  ["pr-multi", "a", fullArray, "mapped=22,44,66,88,110"],
  ["pr-multi", "b", fullArray, "first=11"],
  ["pr-b-only", "b", [11], "first=11"],
  ["webpack-multi", "a", fullArray, "mapped=22,44,66,88,110"],
  ["webpack-multi", "b", [11], "first=11"],
  ["webpack-b-only", "b", [11], "first=11"],
]) {
  const url = new URL(`dist/${name}/${entry}.cjs`, import.meta.url);
  const emitted = readFileSync(url, "utf8");
  const literal = emitted.match(/module\.exports\s*=\s*(\[[0-9,\s]+\])/);
  assert.ok(literal, `${name}/${entry}: emitted JSON array`);
  const emittedArray = JSON.parse(literal[1]);
  assert.deepEqual(emittedArray, expectedArray, `${name}/${entry}`);
  const run = spawnSync(process.execPath, [fileURLToPath(url)], {
    encoding: "utf8", timeout: 5000,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `${name}/${entry}: ${run.stderr}`);
  assert.equal(run.stderr, "", `${name}/${entry}`);
  assert.equal(run.stdout.trim(), expectedOutput, `${name}/${entry}`);
  const label = name.split("-")[0];
  const recorded = JSON.parse(readFileSync(new URL(`results/${label}.json`, import.meta.url), "utf8"))
    .find(result => result.case === name && result.entry === entry);
  assert.ok(recorded, `${name}/${entry}: build record`);
  assert.equal(recorded.buildErrors, false);
  assert.equal(recorded.bundleBytes, Buffer.byteLength(emitted));
  assert.deepEqual(recorded.emittedArray, emittedArray);
  assert.equal(recorded.stdout, expectedOutput);
  results.push({ case: name, entry, emittedArray, bundleBytes: Buffer.byteLength(emitted), stdout: run.stdout.trim() });
}

// The unaffected B entry grows only when A is added to the same compilation.
const prMulti = results.find(result => result.case === "pr-multi" && result.entry === "b");
const prSingle = results.find(result => result.case === "pr-b-only");
assert.equal(prMulti.bundleBytes - prSingle.bundleBytes, 12);
for (const label of ["base", "webpack"]) {
  const multi = readFileSync(new URL(`dist/${label}-multi/b.cjs`, import.meta.url), "utf8");
  const single = readFileSync(new URL(`dist/${label}-b-only/b.cjs`, import.meta.url), "utf8");
  assert.equal(multi, single, `${label}: B output is unaffected by A`);
}

console.table(results.map(result => ({ ...result, emittedArray: JSON.stringify(result.emittedArray) })));
writeFileSync(new URL("results/verification.json", import.meta.url), JSON.stringify({
  node: process.version, platform: process.platform, arch: process.arch, results,
}, null, 2) + "\n");

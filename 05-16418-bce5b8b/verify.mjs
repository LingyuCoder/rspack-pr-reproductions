import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const results = [];
for (const [name, input, expectedStdout] of [
  ["native", "entry.mjs", "value=42"],
  ["base-mangle", "dist/base-mangle/main.cjs", "value=42"],
  ["base-no-mangle", "dist/base-no-mangle/main.cjs", "value=42"],
  ["pr-mangle", "dist/pr-mangle/main.cjs", "value=undefined"],
  ["pr-no-mangle", "dist/pr-no-mangle/main.cjs", "value=undefined"],
  ["webpack-mangle", "dist/webpack-mangle/main.cjs", "value=42"],
  ["webpack-no-mangle", "dist/webpack-no-mangle/main.cjs", "value=42"],
]) {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(input, import.meta.url))], {
    encoding: "utf8", timeout: 5000,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `${name}: ${run.stderr}`);
  assert.equal(run.stderr, "", name);
  assert.equal(run.stdout.trim(), expectedStdout, name);
  const result = { case: name, exitCode: run.status, stdout: run.stdout.trim() };
  if (name !== "native") {
    const emitted = readFileSync(new URL(input, import.meta.url), "utf8");
    const jsonLiteral = emitted.match(/module\.exports\s*=\s*(?:\/\*.*?\*\/\s*)?(?:JSON\.parse\('([^']+)'\)|(\{[^\n;]+\}))/);
    assert.ok(jsonLiteral, `${name}: missing emitted JSON`);
    result.emittedJson = JSON.parse(jsonLiteral[1] || jsonLiteral[2]);
    if (name.startsWith("pr-")) {
      assert.equal(Object.hasOwn(result.emittedJson, "kept"), false, name);
      assert.equal(Object.keys(result.emittedJson).length, 1, name);
      assert.match(emitted, /return this\.kept;/, name);
    } else {
      assert.deepEqual(result.emittedJson, { run: null, kept: 42 }, name);
    }
    if (name === "pr-no-mangle") assert.deepEqual(result.emittedJson, { run: null });
  }
  results.push(result);
}

for (const label of ["pr", "base", "webpack"]) {
  const captured = JSON.parse(readFileSync(new URL(`results/${label}.json`, import.meta.url), "utf8"));
  assert.equal(captured.length, 2, label);
  for (const result of captured) {
    const actual = results.find(item => item.case === result.case);
    assert.ok(actual, result.case);
    assert.equal(result.buildErrors, false, result.case);
    assert.equal(result.buildWarnings, false, result.case);
    assert.equal(result.exitCode, actual.exitCode, result.case);
    assert.equal(result.stdout, actual.stdout, result.case);
    assert.equal(result.stderr, "", result.case);
    assert.deepEqual(result.emittedJson, actual.emittedJson, result.case);
  }
}

console.table(results.map(({ case: name, exitCode, stdout }) => ({ case: name, exitCode, stdout })));
writeFileSync(new URL("results/verification.json", import.meta.url), JSON.stringify({
  node: process.version, platform: process.platform, arch: process.arch, results,
}, null, 2) + "\n");

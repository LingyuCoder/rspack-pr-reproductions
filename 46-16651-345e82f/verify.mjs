import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;
const record = process.argv.includes("--record");
function run(args, env = process.env) {
  const child = spawnSync(process.execPath, args, { cwd: here, env, encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return JSON.parse(child.stdout);
}
function bindingPath(revision) {
  const override = process.env[revision === "base" ? "BASE_BINDING" : "PR_BINDING"];
  if (override) return realpathSync(resolve(override));
  const directory = join(here, ".bindings", revision);
  const matches = readdirSync(directory).filter(file => file.endsWith(".node"));
  assert.equal(matches.length, 1, `Expected one matching native binding in ${directory}; see README.md`);
  return realpathSync(join(directory, matches[0]));
}
const native = run(["--input-type=module", "-e", `
  const module = await import(${JSON.stringify(pathToFileURL(join(here, "src", "index.mjs")).href)});
  console.log(JSON.stringify({ order: globalThis.order, ready: module.ready }));
`]);
assert.deepEqual(native, { order: ["setup", "consumer", "local"], ready: true });
const captures = {};
for (const revision of ["base", "pr"]) {
  const env = { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: bindingPath(revision) };
  delete env.RSPACK_BINDING;
  captures[revision] = run([join(here, "repro.mjs"), revision, ...(record ? ["--record"] : [])], env);
  assert.equal(captures[revision].length, 4);
  for (const variant of captures[revision]) {
    assert.deepEqual(variant.imports, revision === "base" ? ["setup", "consumer"] : ["consumer", "setup"], variant.name);
    assert.equal(variant.status, revision === "base" ? 0 : 1, variant.name);
    assert.deepEqual(variant.result, revision === "base" ? native : { order: ["consumer"], error: "consumer ran before setup" }, variant.name);
  }
}
const observed = { node: process.version, platform: process.platform, arch: process.arch, native, ...captures };
if (record) writeFileSync(join(here, "observed.json"), JSON.stringify(observed, null, 2) + "\n");
console.log(JSON.stringify(observed, null, 2));
console.log("PASS: native ESM and the base initialize setup first; the PR reverses the imports and fails in all four variants.");

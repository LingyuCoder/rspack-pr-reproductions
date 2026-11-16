import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = import.meta.dirname;
const fixtures = join(root, "fixtures");
const scenarios = [
  { entry: "direct", mode: "production", native: "AB" },
  { entry: "array", mode: "production", native: "AB", prError: "ESModulesLinkingError: export 'items'.'default'.'map' (imported as 'items') was not found in './namespace.mjs' (possible exports: 0, 1)" },
  { entry: "object", mode: "production", native: "true", prError: "ESModulesLinkingError: export 'ns'.'default'.'hasOwnProperty' (imported as 'ns') was not found in './namespace.mjs' (possible exports: data)" },
];

function runNode(file, args = [], env = process.env) {
  const child = spawnSync(process.execPath, [file, ...args], { encoding: "utf8", env });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return child.stdout.trim();
}

function bindingPath(revision) {
  const override = process.env[revision.toUpperCase() + "_BINDING"];
  if (override) return realpathSync(resolve(override));
  const dir = join(root, ".bindings", revision);
  const files = readdirSync(dir).filter(f => f.endsWith(".node"));
  assert.equal(files.length, 1, "Expected one CI binding in " + dir);
  return realpathSync(join(dir, files[0]));
}

const record = process.argv.includes("--record");
if (process.argv[2] === "--build") {
  const { rspack } = await import("@rspack/core");
  const revision = process.argv[3];
  const temp = mkdtempSync(join(tmpdir(), "rspack-16639-"));
  const results = {};
  try {
    for (const { entry, mode } of scenarios) {
      const output = join(temp, entry);
      const filename = "bundle.cjs";
      const compiler = rspack({ context: fixtures, entry: "./" + entry + ".mjs", target: "node", mode,
        devtool: false, output: { path: output, filename } });
      let stats;
      try {
        stats = await new Promise((ok, fail) => compiler.run((err, s) => err ? fail(err) : ok(s)));
      } finally {
        await new Promise((ok, fail) => compiler.close(err => err ? fail(err) : ok()));
      }
      const { errors, warnings } = stats.toJson({ all: false, errors: true, warnings: true });
      const headline = d => d.message.trim().split("\n")[0].replace(/^×\s*/, "");
      const file = join(output, filename);
      const stdout = existsSync(file) ? runNode(file) : null;
      results[entry] = { errors: errors.map(headline), warnings: warnings.map(headline), stdout };
      if (record && existsSync(file)) {
        const captures = join(root, "bundles");
        mkdirSync(captures, { recursive: true });
        copyFileSync(file, join(captures, revision + "-" + entry + ".cjs"));
      }
    }
    assert.ok(Object.keys(createRequire(import.meta.url).cache).includes(process.env.NAPI_RS_NATIVE_LIBRARY_PATH),
      "The requested CI native binding was not loaded");
    console.log(JSON.stringify(results));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
} else {
  const results = { native: {} };
  for (const { entry, native } of scenarios) {
    results.native[entry] = runNode(join(fixtures, entry + ".mjs"));
    assert.equal(results.native[entry], native);
  }
  for (const revision of ["base", "pr"]) {
    const args = ["--build", revision, ...(record ? ["--record"] : [])];
    const env = { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: bindingPath(revision) };
    const captured = JSON.parse(runNode(fileURLToPath(import.meta.url), args, env));
    for (const { entry, native, prError, prValue } of scenarios) {
      const error = revision === "pr" && prError;
      const stdout = error ? null : (revision === "pr" ? prValue ?? native : native);
      assert.deepEqual(captured[entry], { errors: error ? [error] : [], warnings: [], stdout }, revision + "/" + entry);
    }
    results[revision] = captured;
  }
  const report = JSON.stringify(results, null, 2) + "\n";
  if (record) writeFileSync(join(root, "observed.json"), report);
  process.stdout.write(report);
}

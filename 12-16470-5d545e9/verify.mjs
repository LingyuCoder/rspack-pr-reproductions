import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const here = import.meta.dirname;
const cache = mkdtempSync(join(tmpdir(), "sri-pr16470-"));
const median = a => { const x = a.toSorted((p,q) => p-q); return (x[(x.length-1)>>1] + x[x.length>>1])/2; };
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: "utf8", ...options });
try {
  let typescript = process.env.TYPESCRIPT_JS;
  if (!typescript) {
    const tgz = run("npm", ["pack", "--silent", "typescript@6.0.3", "--pack-destination", cache]).trim();
    run("tar", ["xzf", join(cache, tgz), "-C", cache, "package/lib/typescript.js"]);
    typescript = join(cache, "package/lib/typescript.js");
  }
  const bins = {};
  for (const [name, id, sha] of [
    ["main", "42769589391", "d30a883abf352d9bad4ee3809cce42eb049589b7"],
    ["pr", "42772939683", "d38c87743dd6c64006734acde2f3f4b409f97af5"],
  ]) {
    let bin = process.env["RSPACK_" + name.toUpperCase() + "_BINDING"];
    if (!bin) {
      assert.equal(process.platform + "-" + process.arch, "darwin-arm64", "Supply matching release bindings on other systems");
      const dest = join(cache, name);
      run("gh", ["run", "download", id, "--repo", "web-infra-dev/rspack", "-n", "bindings-aarch64-apple-darwin", "-D", dest]);
      bin = join(dest, "rspack.darwin-arm64.node");
    }
    bins[name] = bin;
    console.log(name, sha);
  }
  for (const algos of [["sha384"], ["sha256","sha384","sha512"]]) {
    const samples = { main: [], pr: [] };
    for (const side of ["main","pr","pr","main"]) {
      const lines = run(process.execPath, [join(here, "build.mjs"), ...algos], { cwd: here,
        env: { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: bins[side], RAYON_NUM_THREADS: "8", TYPESCRIPT_JS: typescript } });
      samples[side].push(...lines.trim().split("\n").map(line => JSON.parse(line)).filter(r => !r.warmup));
    }
    const medians = {};
    for (const side of ["main","pr"]) {
      medians[side] = median(samples[side].map(r=>r.sriMs));
      console.log(algos.join("+"), side, JSON.stringify({
        warmSamples: samples[side].length, sriMedianMs: +medians[side].toFixed(2),
        totalMedianMs: +median(samples[side].map(r=>r.totalMs)).toFixed(2),
        emittedBytes: samples[side][0].emittedBytes,
      }));
    }
    if (algos.length > 1) assert.ok(medians.pr > medians.main * 1.20, "Expected the multi-algorithm SRI stage to regress on a machine with multiple available cores");
  }
} finally { rmSync(cache, { recursive: true, force: true }); }

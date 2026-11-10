import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixture.cjs", import.meta.url));

function run(binding) {
  const result = spawnSync(process.execPath, [fixture], {
    encoding: "utf8",
    env: { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: binding },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

const bindings = process.argv.slice(2);
assert.ok(bindings.length === 0 || bindings.length === 2, "pass base and PR binding paths");
const [base, head] = bindings.length === 2
  ? bindings.map(run)
  : JSON.parse(fs.readFileSync(new URL("./comparison.json", import.meta.url)));
assert.equal(base.alive, false);
assert.equal(head.alive, true);
assert.equal(base.probeIsOnlyInputOwner, true);
assert.equal(head.probeIsOnlyInputOwner, false);
assert.equal(base.inputBytes, head.inputBytes);
assert.equal(base.minifiedBytes, head.minifiedBytes);
assert.ok(head.inputBytes > 8_000_000 && head.minifiedBytes < 1024);
console.log(JSON.stringify({ base, head }));

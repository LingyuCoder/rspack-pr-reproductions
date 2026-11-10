import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const bindings = process.argv.slice(2);
assert.ok(bindings.length === 0 || bindings.length === 2);
const data = bindings.length ? bindings.map(binding => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./fixture.cjs', import.meta.url))], {
    encoding: 'utf8', env: { ...process.env, NAPI_RS_NATIVE_LIBRARY_PATH: binding }
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
}) : JSON.parse(readFileSync(new URL(process.env.VENDOR_JS ? './vendor.json' : './comparison.json', import.meta.url)));
const [base, head] = data;
assert.equal(base.js, head.js);
assert.equal(base.map, head.map);
assert.equal(base.allocation, head.allocation);
assert.ok(head.allocation >= head.original && head.original > 0);
assert.equal(base.original, head.original);
assert.equal(base.refs, 0);
assert.equal(base.state, 'dropped');
assert.ok(head.refs > 0);
assert.equal(head.state, 'alive');
console.log(JSON.stringify(data, null, 2));

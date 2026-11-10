import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
function run(binding) {
  const r = spawnSync(process.execPath,[fileURLToPath(new URL('./fixture.cjs',import.meta.url))],{encoding:'utf8',env:{...process.env,NAPI_RS_NATIVE_LIBRARY_PATH:binding}});
  assert.equal(r.status,0,r.stderr+r.stdout);
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
}
const bindings = process.argv.slice(2);
assert.ok(bindings.length===0 || bindings.length===2);
const [base,head] = bindings.length ? bindings.map(run) : JSON.parse(fs.readFileSync(new URL(process.env.VENDOR_JS ? './colorjs-comparison.json' : './comparison.json',import.meta.url)));
assert.equal(base.inputBytes,process.env.VENDOR_JS ? 9643 : 8450020); assert.equal(base.inputBytes,head.inputBytes);
assert.equal(base.sha256,head.sha256);
assert.equal(base.liveStrongReferences,0); assert.equal(base.allocationState,'dropped');
assert.ok(head.liveStrongReferences>0); assert.equal(head.allocationState,'alive'); assert.equal(base.allocationBytes,head.allocationBytes); assert.ok(head.allocationBytes >= head.inputBytes);
console.log(JSON.stringify([base,head]));

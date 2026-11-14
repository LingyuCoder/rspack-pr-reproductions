import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const success = { exit: 0, order: ['x', 'z'], z: 1 };
const failure = { exit: 1, order: [], error: 'x has not initialized' };
const results = {};
for (const revision of ['base', 'head']) {
  results[revision] = {};
  for (const mode of ['default', 'rspack']) {
    const p = spawnSync(process.execPath, [path.join(import.meta.dirname, 'build.mjs'), revision, mode], { encoding: 'utf8' });
    if (p.error) throw p.error;
    assert.equal(p.status, 0, p.stderr || p.stdout);
    const result = JSON.parse(p.stdout.trim().split('\n').at(-1));
    assert.deepEqual(result.native, success);
    assert.deepEqual(result.bundle, revision === 'base' ? success : failure, revision + '/' + mode);
    const external = result.requests.flatMap(line => line.match(/["'](\.\/[xz]\.[cm]js)["']/)?.[1] ?? []);
    assert.deepEqual(external, revision === 'base' ? ['./x.cjs', './z.mjs'] : ['./z.mjs', './x.cjs']);
    results[revision][mode] = result;
  }
}
if (process.env.RESULT_FILE) {
  fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(results, null, 2) + '\n');
}
console.log('Verified both runtime modes: native and main initialize x before z; PR head evaluates z first and throws.');

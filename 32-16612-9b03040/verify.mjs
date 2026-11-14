import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const results = {};
for (const revision of ['base', 'head']) {
  results[revision] = {};
  for (const layout of ['shared', 'separate']) {
    const p = spawnSync(process.execPath, [path.join(import.meta.dirname, 'build.mjs'), revision, layout], { encoding: 'utf8' });
    if (p.error || p.status !== 0) throw p.error || Error(p.stderr || p.stdout);
    const result = JSON.parse(p.stdout.trim().split('\n').at(-1));
    const fromA = {exit: 0, order: ['setup', 'x'], tag: 'setup-first', value: 1};
    const fromB = {exit: 0, order: ['x', 'setup'], tag: 'normal', value: 2};
    assert.deepEqual(result.source, {loadA: fromA, loadB: fromB});
    if (revision === 'head' && layout === 'shared') {
      assert.deepEqual(result.bundle.loadA, {exit: 1, order: ['x'], error: 'setup must run before x'});
    } else {
      assert.deepEqual(result.bundle.loadA, fromA);
    }
    assert.equal(result.bundle.loadB.exit, 0);
    assert.equal(result.bundle.loadB.tag, 'normal');
    assert.equal(result.bundle.loadB.value, 2);
    if (layout === 'separate') assert.deepEqual(result.bundle.loadB, fromB);
    results[revision][layout] = result;
  }
}
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(results, null, 2) + '\n');
console.log('Verified: both loaders resolve on the base; only loadA rejects on the PR; separate chunk names restore both.');

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const success = { exit: 0, order: ['z', 'c'] };
const failure = { exit: 1, order: [], error: 'setup must precede c' };
const results = {};
for (const revision of ['base', 'head']) {
  results[revision] = {};
  for (const runtime of ['default', 'rspack']) {
    const cases = results[revision][runtime] = {};
    for (const declarationOrder of ['first-then-second', 'second-then-first']) {
      const cp = spawnSync(process.execPath,
        [path.join(import.meta.dirname, 'build.mjs'), revision, runtime, declarationOrder],
        { encoding: 'utf8' });
      if (cp.status !== 0 || cp.error) throw new Error(cp.stderr || cp.error);
      const result = JSON.parse(cp.stdout.trim().split('\n').at(-1));
      assert.deepEqual(result.native, { first: success, second: success });
      assert.deepEqual(result.bundle.first, success);
      assert.deepEqual(result.bundle.second,
        revision === 'head' && declarationOrder === 'first-then-second' ? failure : success);
      cases[declarationOrder] = result;
    }
  }
}
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(results, null, 2) + '\n');
console.log('Both runtime modes: source and base load both entries; on the head, second fails only when first is declared before it.');

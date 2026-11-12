import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const checks = [
  ['source', "import './src/setup.mjs'; import { value } from './src/entry.mjs';"],
  ['base', "import { value } from './dist/base/main.mjs';"],
  ['pr', "import { value } from './dist/pr/main.mjs';"],
];
for (const [label, imports] of checks) {
  const script = imports + '\nconsole.log(value);';
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (label === 'pr') {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: setup must run first/);
    console.log('pr: Error: setup must run first');
  } else {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '42');
    console.log(`${label}: 42`);
  }
}

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const checks = [
  ['source', './src/entry.mjs'],
  ['base', './dist/base/main.mjs'],
  ['pr', './dist/pr/main.mjs'],
];
for (const [label, entry] of checks) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e',
    'import { value } from ' + JSON.stringify(entry) + '; console.log(value);'],
    { cwd: import.meta.dirname, encoding: 'utf8' });
  if (run.error) throw run.error;
  if (label === 'pr') {
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Error: setup must run first/);
    console.log(label + ': ' + run.stderr.split('\n').find(line => line.startsWith('Error:')));
  } else {
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), '42');
    console.log(label + ': ' + run.stdout.trim());
  }
}

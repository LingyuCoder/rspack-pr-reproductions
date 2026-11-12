import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const checks = [
  ['source', './src/entry.mjs', [1, 2]],
  ['base', './dist/base/main.mjs', [1, 2]],
  ['pr', './dist/pr/main.mjs', [1, 1]],
];
for (const [label, entry, expected] of checks) {
  const script = `
    import * as library from ${JSON.stringify(entry)};
    const before = library.default;
    library.update();
    console.log(JSON.stringify({ before, after: library.default, sideLoaded: globalThis.sideLoaded }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual([actual.before, actual.after], expected, label);
  assert.equal(actual.sideLoaded, true, label);
  console.log(`${label}: default ${actual.before} -> ${actual.after}`);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const [revision, expected] of [['base', 'v2/index.js'], ['pr', 'v1/index.js']]) {
  const saved = JSON.parse(readFileSync(new URL('./results/' + revision + '.json', import.meta.url)));
  assert.deepEqual(saved, { before: 'v1/index.js', afterClear: expected, fresh: 'v2/index.js', yarnAfterInstall: 'v2/index.js' });
}
console.log('Verified: only the PR keeps resolving the previous dependency after clearCache().');

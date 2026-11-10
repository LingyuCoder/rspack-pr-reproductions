import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const [name, afterClear] of [['base', 'app/dep/index.js'], ['head', 'dep/index.js']]) {
  const result = JSON.parse(readFileSync(new URL('./results/' + name + '.json', import.meta.url)));
  assert.deepEqual(result, {
    before: 'dep/index.js', afterClear, fresh: 'app/dep/index.js', yarn: 'app/dep/index.js',
  });
}
console.log('Verified: only the reused PR resolver returns the parent project’s dep after clearCache().');

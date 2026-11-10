import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

for (const variant of ['base', 'head']) {
  const read = path => readFileSync(new URL(path, import.meta.url));
  const capture = JSON.parse(read(variant + '.json'));
  const bytes = read('output-' + variant + '/leaf.js');
  const expected = 'sha256-' + createHash('sha256').update(bytes).digest('base64');
  assert.equal(capture.expected, expected);
  assert.deepEqual(capture.initial, ['shared.js', 'page.js']);
  assert.equal(capture.tests.length, 2);
  for (const [i, result] of capture.tests.entries()) {
    const tamper = i === 1;
    const blocked = tamper && variant === 'base';
    assert.deepEqual(result, {
      tamper, integrity: variant === 'base' ? expected : 'undefined',
      value: blocked ? null : 42, error: blocked ? 'ChunkLoadError' : null,
      tamperedCodeRan: tamper && !blocked,
    });
  }
}
console.log('Verified: Chrome blocked the modified leaf on base and executed it on the PR.');

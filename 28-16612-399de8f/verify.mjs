import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const results = {};
for (const revision of ['base','head']) {
  results[revision] = {};
  for (const scenario of ['chunkhash','incremental']) {
    results[revision][scenario] = {};
    for (const kind of ['cold','watch']) {
    const p = spawnSync(process.execPath, [path.join(import.meta.dirname,'build.mjs'), revision, kind, scenario],
      {encoding:'utf8', timeout:45000});
    if (p.error || p.status !== 0) throw Error(p.error || p.stderr || p.stdout);
    const rows = JSON.parse(p.stdout.trim().split('\n').at(-1));
    const row = rows.at(-1);
    assert.equal(row.native.edited, true);
    assert.deepEqual(row.native.order, ['A','B']);
    assert.equal(row.native.b, true);
    assert.equal(row.bundle.edited, true);
    assert.equal(row.bundle.child, 42);
    const stale = revision === 'head' && kind === 'watch';
    assert.deepEqual(row.bundle.order, stale ? ['B','A'] : ['A','B']);
    assert.equal(row.bundle.b, !stale);
    if (kind === 'watch') {
      assert.equal(rows.length, 2);
      assert.deepEqual(rows[0].native.order, ['B','A']);
      if (revision === 'head') assert.deepEqual(rows[0].bundle, rows[0].native);
    }
    if (revision === 'head' && kind === 'cold' && scenario === 'chunkhash') {
      assert.equal(rows[0].shared, rows[1].shared);
      assert.notDeepEqual(rows[0].declarations, rows[1].declarations);
    }
    results[revision][scenario][kind] = rows;
    }
  }
}
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(results,null,2)+'\n');
console.log('Verified both chunkhash and incremental contenthash after editing the entry: native, base watch, base cold and head cold = A,B (b=true); head watch = B,A (b=false).');

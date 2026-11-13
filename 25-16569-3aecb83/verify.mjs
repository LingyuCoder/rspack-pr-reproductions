import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const provenance = JSON.parse(readFileSync(new URL('provenance.json', import.meta.url), 'utf8'));
const live = process.argv.includes('--live');
if (live) {
  for (const label of ['base', 'pr', 'watchpack']) {
    const native = label !== 'watchpack';
    const binding = process.env[label === 'base' ? 'BASE_BINDING' : 'PR_BINDING'];
    assert.ok(!native || binding, `Set ${label === 'base' ? 'BASE_BINDING' : 'PR_BINDING'}`);
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('capture.mjs', import.meta.url)), label], {
      stdio: 'inherit',
      env: { ...process.env, ...(native ? {
        RSPACK_BINDING: binding,
        RSPACK_BINDING_SOURCE_SHA: provenance[`${label}Binding`].sourceSha,
      } : {}) },
    });
    assert.equal(child.status, 0, `${label}: live capture failed`);
  }
}

const rows = [];
for (const label of ['base', 'pr', 'watchpack']) {
  const capture = JSON.parse(readFileSync(new URL(`results/${label}.json`, import.meta.url), 'utf8'));
  assert.equal(capture.label, label);
  assert.equal(capture.results.length, 3);
  if (label === 'watchpack') assert.equal(capture.version, provenance.watchpack);
  else {
    assert.equal(capture.bindingSourceSha, provenance[`${label}Binding`].sourceSha);
    assert.match(capture.bindingSha256, /^[a-f0-9]{64}$/);
  }
  for (const result of capture.results) {
    assert.deepEqual(result.errors, []);
    assert.equal(result.filesystemMutationAfterWatch, null);
    assert.ok(result.changedMtime > result.startTime);
    assert.equal(result.contentsAtBuildStart, 'initial contents');
    assert.equal(result.contentsAtWatch, 'edited during build');
    assert.deepEqual(result.removedFiles, []);
    const expected = result.scenario === 'overlap'
      ? label === 'base' ? ['app', 'app/link'] : label === 'pr' ? [] : ['app']
      : result.scenario === 'nested-only' ? ['app'] : label === 'base' ? ['app/link'] : [];
    assert.deepEqual(result.changedFiles, expected, `${label}/${result.scenario}: unexpected changes`);
    const expectedTimestamp = result.scenario === 'nested-only' || label === 'base'
      || (label === 'watchpack' && result.scenario === 'overlap');
    assert.equal(result.aliasTimestampRecorded, expectedTimestamp, `${label}/${result.scenario}: timestamp`);
    rows.push({ implementation: label, scenario: result.scenario,
      changedFiles: result.changedFiles.join(', '), aliasTimestamp: result.aliasTimestampRecorded });
  }
}
console.table(rows);
console.log(`${live ? 'LIVE' : 'SAVED CAPTURES'}: confirmed the overlapping-context startup regression; both single-context controls match the documented filtering rules on the PR.`);

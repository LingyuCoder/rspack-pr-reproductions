import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const live = process.argv.includes('--live');
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', import.meta.url)));
if (live) assert.equal(process.platform, 'linux', 'the regression vs. base was verified on Linux');
const both = ['app', 'app/link'];
const expected = {
  base: { overlap: both, 'parent-only': [], 'no-ignore': both },
  pr: { overlap: [], 'parent-only': ['app'], 'no-ignore': both },
  watchpack: { overlap: ['app'], 'parent-only': ['app'], 'no-ignore': both },
};
for (const [engine, cases] of Object.entries(expected)) {
  const url = new URL('results/' + engine + '.json', import.meta.url);
  const contents = live
    ? execFileSync(process.execPath, [fileURLToPath(new URL('capture.mjs', import.meta.url)), engine], { encoding: 'utf8', timeout: 60000 })
    : fs.readFileSync(url, 'utf8');
  const run = JSON.parse(contents);
  assert.equal(run.engine, engine);
  assert.equal(run.platform, 'linux');
  if (engine === 'watchpack') assert.equal(run.version, provenance.watchpack);
  else if (run.arch === 'x64') assert.equal(run.sha256, provenance[engine].sha256, 'wrong CI binary');
  assert.deepEqual(run.observations.map(r => r.scenario), Object.keys(cases));
  for (const r of run.observations) {
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.targetRemovals, []);
    assert.equal(r.contentsViaAlias, 'live target edit');
    assert.deepEqual(r.ordinaryEdit, ['app']);
    assert.deepEqual(r.targetEdit, cases[r.scenario], engine + '/' + r.scenario);
    console.log(engine, r.scenario, JSON.stringify(r.targetEdit));
  }
  if (live) {
    fs.mkdirSync(new URL('results/', import.meta.url), { recursive: true });
    fs.writeFileSync(url, contents);
  }
}
console.log((live ? 'LIVE' : 'SAVED CAPTURES') + ': the overlapping contexts lose the live parent notification on Linux.');

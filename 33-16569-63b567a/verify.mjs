import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const live = process.argv.includes('--live');
const alias = 'app/link/value.js';
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', import.meta.url)));
const expected = {
  base: { both: ['app', alias], 'context-only': ['app'], 'file-only': [alias], 'without-ignore': ['app', alias] },
  pr: { both: [], 'context-only': ['app'], 'file-only': [], 'without-ignore': ['app', alias] },
  watchpack: { both: ['app'], 'context-only': ['app'], 'file-only': [], 'without-ignore': ['app', alias] },
};
for (const [engine, results] of Object.entries(expected)) {
  const url = new URL('results/' + engine + '.json', import.meta.url);
  const source = live ? execFileSync(process.execPath, [fileURLToPath(new URL('capture.mjs', import.meta.url)), engine],
    { encoding: 'utf8', timeout: 40000 }) : fs.readFileSync(url, 'utf8');
  const run = JSON.parse(source);
  assert.equal(run.engine, engine);
  if (engine === 'watchpack') assert.equal(run.version, provenance.watchpack);
  else if (run.platform === 'darwin' && run.arch === 'arm64') assert.equal(run.sha256, provenance[engine].sha256, 'wrong CI binary');
  assert.deepEqual(run.observations.map(row => row.scenario), Object.keys(results));
  for (const row of run.observations) {
    assert.deepEqual(row.errors, []);
    assert.deepEqual(row.removals, []);
    assert.equal(row.firstRead, 'before');
    assert.equal(row.lastRead, 'after');
    assert.ok(row.mtime > row.startTime);
    assert.deepEqual(row.changes, results[row.scenario], engine + '/' + row.scenario);
    if (row.scenario === 'both') assert.equal(row.aliasIndexed, true);
    console.log(engine, row.scenario, JSON.stringify(row.changes));
  }
  if (live) {
    fs.mkdirSync(new URL('results/', import.meta.url), { recursive: true });
    fs.writeFileSync(url, source);
  }
}
console.log((live ? 'LIVE' : 'SAVED CAPTURES') + ': registering the file suppresses the allowed context notification on the PR.');

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

for (const name of ['BASE_CORE', 'HEAD_CORE', 'BINDING']) {
  assert.ok(path.isAbsolute(process.env[name] ?? ''), `Set ${name} to an absolute path; see README.md.`);
}

function run(revision, variant) {
  const env = { ...process.env, RSPACK_CORE: process.env[`${revision}_CORE`], RSPACK_BINDING: process.env.BINDING };
  delete env.NAPI_RS_NATIVE_LIBRARY_PATH;
  const child = spawnSync(process.execPath, ['repro.mjs', variant], {
    cwd: import.meta.dirname,
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr);
  const line = child.stdout.split('\n').find(line => line.startsWith('RESULT '));
  assert.ok(line, child.stdout + child.stderr);
  return { revision, ...JSON.parse(line.slice('RESULT '.length)) };
}

function assertLoads(result, { stage, listedInChunk }) {
  assert.equal(result.error, null);
  assert.equal(result.value, 'fallback-runtime-ok');
  assert.match(result.fallback, /\/1\.0\.0\/share-entry\.js$/);
  assert.deepEqual(result.processing, { stage, assetExists: true, listedInChunk });
}

const base = run('BASE', 'replace-early');
assertLoads(base, { stage: 401, listedInChunk: false });
const head = run('HEAD', 'replace-early');
assert.deepEqual(head.processing, { stage: 401, assetExists: true, listedInChunk: false });
assert.equal(head.error, 'no files found for shared compat-shared chunk');
assert.equal(head.fallback, null);
const late = run('HEAD', 'replace-late');
assertLoads(late, { stage: 3000, listedInChunk: false });
const update = run('HEAD', 'update-early');
assertLoads(update, { stage: 401, listedInChunk: true });
assert.equal(late.fallback, base.fallback);
assert.equal(update.fallback, base.fallback);

const output = { node: process.version, platform: process.platform, arch: process.arch, captures: [base, head, late, update] };
if (process.argv.includes('--record')) {
  fs.writeFileSync(path.join(import.meta.dirname, 'observed.json'), JSON.stringify(output, null, 2) + '\n');
}
console.log(JSON.stringify(output, null, 2));
console.log('PASS: a live, loadable same-name asset on base becomes a compile error at the reviewed head.');

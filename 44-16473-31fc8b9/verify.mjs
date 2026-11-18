import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
for (const name of ['BASE_CORE', 'HEAD_CORE', 'BINDING']) {
  assert.ok(path.isAbsolute(process.env[name] ?? ''), `Set ${name} to an absolute path; see README.md.`);
}
const captures = [];
function run(label, core, deleteOriginals) {
  const env = {
    ...process.env, RSPACK_CORE: core, RSPACK_BINDING: process.env.BINDING,
    DELETE_ORIGINALS: String(deleteOriginals),
  };
  delete env.NAPI_RS_NATIVE_LIBRARY_PATH;
  const result = spawnSync(process.execPath, ['repro.mjs'], {
    cwd: here, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const line = result.stdout.split('\n').find(line => line.startsWith('RESULT '));
  assert.ok(line, result.stdout + result.stderr);
  const observed = JSON.parse(line.slice('RESULT '.length));
  if (observed.error) {
    for (const [key, value] of Object.entries({ BASE_CORE: process.env.BASE_CORE, HEAD_CORE: process.env.HEAD_CORE, FIXED_CORE: process.env.FIXED_CORE })) {
      if (value) observed.error = observed.error.replaceAll(path.dirname(fs.realpathSync(value)), `<${key}>`);
    }
  }
  captures.push({ label, ...observed });
  return observed;
}
function successful(result, deleted) {
  assert.equal(result.success, true, result.error ?? JSON.stringify(result.statsErrors));
  assert.equal(result.gzipContainsSharedValue, true);
  assert.deepEqual(result.fallbackFiles, deleted ? ['share-entry.js.gz'] : ['share-entry.js', 'share-entry.js.gz']);
  assert.deepEqual(result.callbackAssets['compat-shared'], [[
    'independent-packages/compat_shared/1.0.0/share-entry.js',
    '1.0.0', 'compression_compat_f_compat_shared_100',
  ]]);
}
successful(run('base-delete-originals', process.env.BASE_CORE, true), true);
const head = run('head-delete-originals', process.env.HEAD_CORE, true);
assert.equal(head.success, false);
assert.match(head.error, /no files found for shared compat-shared chunk/);
assert.equal(head.callbackAssets, null);
successful(run('head-keep-originals', process.env.HEAD_CORE, false), false);
if (process.env.FIXED_CORE) successful(run('head-stage-2501-control', process.env.FIXED_CORE, true), true);
const output = { node: process.version, platform: process.platform, arch: process.arch, captures };
if (process.argv.includes('--record')) fs.writeFileSync(path.join(here, 'observed.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
console.log('PASS: the base builds gzip-only shared fallbacks; the PR head fails, while retaining originals succeeds.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const cwd = import.meta.dirname;
for (const name of ['HEAD_CORE', 'HEAD_BINDING', 'BASE_CORE', 'BASE_BINDING']) {
  assert.ok(process.env[name], `Set ${name} to an absolute path before running this live verifier.`);
  assert.ok(path.isAbsolute(process.env[name]), `${name} must be absolute`);
}
const captures = [];
function run(label, revision, extra = {}) {
  const env = {...process.env, ...extra,
    RSPACK_CORE: process.env[revision + '_CORE'],
    NAPI_RS_NATIVE_LIBRARY_PATH: process.env[revision + '_BINDING']
  };
  delete env.RSPACK_BINDING;
  const result = spawnSync(process.execPath, ['repro.cjs'], {cwd, env, encoding:'utf8', timeout:60000, maxBuffer:8*1024*1024});
  if (result.error) throw result.error;
  const capture = {label, status:result.status, signal:result.signal,
    stdout:result.stdout.replaceAll(cwd,'<case>').replaceAll(fs.realpathSync(cwd),'<case>'),
    stderr:result.stderr.replaceAll(cwd,'<case>').replaceAll(fs.realpathSync(cwd),'<case>')};
  captures.push(capture);
  return capture;
}
function save() {
  if (process.env.RECORD === '1') fs.writeFileSync(path.join(cwd,'comparison.json'), JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,captures},null,2)+'\n');
}

const base = run('base', 'BASE', {NO_FAILURE:'0',IMPORT_DELAY:'300',FAIL_DELAY:'50'});
assert.equal(base.status,0,base.stderr);
assert.match(base.stdout,/import completed: payload/);
assert.match(base.stdout,/closed without crashing/);
const head = run('head', 'HEAD', {NO_FAILURE:'0',IMPORT_DELAY:'300',FAIL_DELAY:'50'});
assert.ok(head.signal==='SIGABRT' || head.status===134,JSON.stringify(head));
assert.match(head.stdout,/run callback: expected hook error/);
assert.match(head.stderr,/should have module executor/);
for (const [label,extra] of [
  ['head-no-failure',{NO_FAILURE:'1',IMPORT_DELAY:'300',FAIL_DELAY:'50'}],
  ['head-import-before-failure',{NO_FAILURE:'0',IMPORT_DELAY:'1',FAIL_DELAY:'500'}]
]) {
  const control=run(label,'HEAD',extra);
  assert.equal(control.status,0,control.stderr);
  assert.match(control.stdout,/closed without crashing/);
}
save();
console.log('PASS: base and both head controls exit 0; head after failure aborts with a missing executor.');

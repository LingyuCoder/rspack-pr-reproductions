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
  const result = spawnSync(process.execPath, ['repro.mjs'], {cwd, env, encoding:'utf8', timeout:60000, maxBuffer:8*1024*1024});
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

for (const [label,revision,expectedRoots,expectedBuilds] of [['base','BASE',1,3],['head','HEAD',100,202]]) {
  const result=run(label,revision);
  assert.equal(result.status,0,result.stderr);
  const data=JSON.parse(result.stdout);
  assert.equal(data.n,100);
  assert.equal(data.observations.length,3);
  for(const observation of data.observations) {
    assert.equal(observation.actual,observation.expected);
    assert.equal(observation.normalRoots,expectedRoots);
    assert.equal(observation.built,expectedBuilds);
  }
  console.log(`${label}: ${expectedBuilds} buildModule calls, ${expectedRoots} root stylesheets per edit; all three outputs correct.`);
}
save();
console.log('PASS: head invalidates all shared CSS producers during an ordinary single-file rebuild.');

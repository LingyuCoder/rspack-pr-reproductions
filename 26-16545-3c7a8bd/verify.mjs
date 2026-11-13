import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const head = '3c7a8bdd7a19d6aa0469583e1e9041d870e5c2bb';
assert(process.env.RSPACK_REPO, 'Set RSPACK_REPO to a checkout of the reviewed head with native and JS artifacts built.');
const repo = resolve(process.env.RSPACK_REPO);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
assert.equal(revision.status, 0, revision.stderr);
assert.equal(revision.stdout.trim(), head, 'The live runner must use the reviewed revision.');

const relativeSource = 'tests/rspack-test/esmOutputCases/externals/external-reexport-default-live-binding';
const fixture = join(import.meta.dirname, 'fixture');
const hook = readFileSync(join(fixture, 'test.config.mjs'), 'utf8');
assert.equal(readFileSync(join(repo, relativeSource, 'test.config.mjs'), 'utf8'), hook);
const suiteRoot = join(repo, 'tests/rspack-test');
const target = mkdtempSync(join(suiteRoot, 'esmOutputCases/externals/repro-16545-url#'));
const caseName = basename(target);
const results = join(import.meta.dirname, 'results');
mkdirSync(results, { recursive: true });
const outputDirs = ['esmOutput', 'runtime-mode-esm-output'].map(mode => join(suiteRoot, 'js', mode, 'externals', caseName));
const normalize = value => value.replaceAll(repo, '<RSPACK_REPO>').replaceAll(caseName, 'repro-16545-url#CASE');
const summary = { head, node: process.version, platform: process.platform, arch: process.arch };

function run(variant) {
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
    '--dir', 'tests/rspack-test', 'test', 'EsmOutput.test.mjs', '-t', caseName, '-u',
  ], { cwd: repo, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  const output = `${result.stdout}\n${result.stderr}`;
  writeFileSync(join(results, `${variant}.log`), normalize(output));
  for (const [index, out] of outputDirs.entries()) {
    const main = join(out, 'main.mjs');
    assert(existsSync(main), 'The actual suite must build the library before exercising its hook.');
    writeFileSync(join(results, `${variant}-${index === 0 ? 'modern' : 'runtime'}-main.mjs`), normalize(readFileSync(main, 'utf8')));
  }
  summary[variant] = { status: result.status, command: 'pnpm --dir tests/rspack-test test EsmOutput.test.mjs -t "repro-16545-url#CASE" -u' };
  return { status: result.status, output };
}

try {
  cpSync(fixture, target, { recursive: true });
  const original = run('original');
  assert.notEqual(original.status, 0, 'Raw filesystem paths should reproduce the import failure.');
  assert.match(original.output, /ERR_MODULE_NOT_FOUND|ERR_UNSUPPORTED_ESM_URL_SCHEME/);

  // The control changes only the native-import specifier, leaving the bundler,
  // real test runner, fixture, runtime assertions and output location intact.
  assert.equal(hook.split('await import(mainUrl)').length, 2);
  writeFileSync(join(target, 'test.config.mjs'),
    "import { pathToFileURL } from 'node:url';\n" +
    hook.replace('await import(mainUrl)', 'await import(pathToFileURL(mainUrl).href)'));
  const control = run('file-url-control');
  assert.equal(control.status, 0, control.output);
  assert.match(control.output, /Test Files\s+2 passed/);
  assert.match(control.output, /Tests\s+2 passed/);

  // Execute the unmodified PR hook with a drive-letter path on any OS. Node
  // rejects its c: protocol before filesystem lookup or assertion execution.
  const configUrl = pathToFileURL(join(fixture, 'test.config.mjs')).href;
  const windows = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import config from ${JSON.stringify(configUrl)};
    try {
      await config.afterExecute({output:{path:${JSON.stringify('C:\\rspack\\dist')}}});
      throw new Error('Expected a drive-letter URL failure');
    } catch (error) {
      if (error.code !== 'ERR_UNSUPPORTED_ESM_URL_SCHEME') throw error;
      console.log(JSON.stringify({code:error.code,message:error.message}));
    }
  `], { encoding: 'utf8' });
  assert.equal(windows.status, 0, windows.stderr);
  summary.windowsPathProbe = JSON.parse(windows.stdout);
  writeFileSync(join(results, 'comparison.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('Verified: original hooks fail on a # path; file-URL control passes both real suites.');
  console.log('Verified: the unmodified hook rejects a Windows drive path with ERR_UNSUPPORTED_ESM_URL_SCHEME.');
} finally {
  rmSync(target, { recursive: true, force: true });
  for (const out of outputDirs) rmSync(out, { recursive: true, force: true });
}

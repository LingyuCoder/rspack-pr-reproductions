import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');
const baseSha = '90374d632fb7b73c7e3ba01eb96046df054ac0a0';
const headSha = '2fa4acf9415d3ac948c323a6eee9d3a75997282e';
const fixturePath = 'tests/rspack-test/statsOutputCases/ignore-warnings/rspack.config.ts';
const base = fs.readFileSync(path.join(here, 'base.config.ts'), 'utf8');
const head = fs.readFileSync(path.join(here, 'head.config.ts'), 'utf8');
const fixed = head.replace('type Compilation }', 'type Compilation, type Module }')
  .replace("module: { readableIdentifier: () => 'warning' },", "module: { readableIdentifier: () => 'warning' } as Module,");
assert.notEqual(fixed, head);
fs.writeFileSync(path.join(here, '.fixed-control.config.ts'), fixed);

function compile(file) {
  const result = spawnSync(process.execPath, [compiler,
    '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler',
    '--strict', '--noEmit', '--skipLibCheck', '--esModuleInterop', '--types', 'node', file
  ], { cwd: here, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { exitCode: result.status, diagnostic: (result.stdout + result.stderr).trim() };
}

try {
  const results = {
    node: process.version,
    typescript: require('typescript/package.json').version,
    rspackCore: require('@rspack/core/package.json').version,
    baseSha, headSha, fixturePath,
    fixtureSha256: {
      base: createHash('sha256').update(base).digest('hex'),
      head: createHash('sha256').update(head).digest('hex')
    },
    base: compile('base.config.ts'),
    head: compile('head.config.ts'),
    typedModuleControl: compile('.fixed-control.config.ts')
  };
  assert.equal(results.base.exitCode, 0, results.base.diagnostic);
  assert.equal(results.head.exitCode, 2, results.head.diagnostic);
  assert.match(results.head.diagnostic, /head\.config\.ts\(20,27\): error TS2345/);
  assert.match(results.head.diagnostic, /missing the following properties from type 'Module'/);
  assert.equal((results.head.diagnostic.match(/error TS\d+/g) ?? []).length, 1);
  assert.equal(results.typedModuleControl.exitCode, 0, results.typedModuleControl.diagnostic);
  if (process.argv.includes('--record')) {
    fs.writeFileSync(path.join(here, 'observed.json'), JSON.stringify(results, null, 2) + '\n');
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  fs.rmSync(path.join(here, '.fixed-control.config.ts'), { force: true });
}

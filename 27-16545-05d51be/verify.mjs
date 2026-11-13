import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = import.meta.dirname;
const fixtures = ['lazy-require', 'require-resolve', 'eager-dynamic'];
for (const key of ['BASE_CORE', 'BASE_BINDING', 'HEAD_CORE', 'HEAD_BINDING']) {
  assert(process.env[key], `Set ${key}; see README.md for exact source revisions and build instructions.`);
}
const execute = (cwd, file) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import * as lib from './${file}.mjs'; console.log(JSON.stringify({value:lib.value,helperLoaded:globalThis.helperLoaded}));`,
  ], { cwd, encoding: 'utf8', timeout: 10000 });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.replaceAll(root, '<CASE_DIR>').trim(),
  };
};
const result = { node: process.version, platform: process.platform, arch: process.arch, source: {}, comparisons: [] };
for (const fixture of fixtures) {
  const source = execute(join(root, 'fixtures', fixture), 'entry');
  assert.equal(source.status, 0, source.stderr);
  assert.deepEqual(JSON.parse(source.stdout), { value: 42, helperLoaded: true });
  result.source[fixture] = source;
}

for (const runtime of ['default', 'rspack']) {
  for (const size of ['readable', 'min']) {
    for (const fixture of fixtures) {
      const comparison = { fixture, runtime, size };
      for (const variant of ['base', 'pr']) {
        const prefix = variant === 'base' ? 'BASE' : 'HEAD';
        const built = spawnSync(process.execPath, [join(root, 'build.mjs'), variant, fixture, runtime, size], {
          cwd: root,
          encoding: 'utf8',
          timeout: 30000,
          env: {
            ...process.env,
            RSPACK_CORE: resolve(process.env[`${prefix}_CORE`]),
            NAPI_RS_NATIVE_LIBRARY_PATH: resolve(process.env[`${prefix}_BINDING`]),
          },
        });
        if (built.error) throw built.error;
        assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
        const out = runtime === 'default' && size === 'readable'
          ? join(root, 'dist', variant, fixture)
          : join(root, '.work', runtime, size, variant, fixture);
        comparison[variant] = execute(out, 'main');
        if (variant === 'base') {
          assert.equal(comparison.base.status, 0, comparison.base.stderr);
          assert.equal(comparison.base.stdout, result.source[fixture].stdout);
        } else {
          assert.notEqual(comparison.pr.status, 0, 'The reviewed head should reproduce the regression.');
          assert.match(comparison.pr.stderr, /Error: setup must run first/);
        }
        if (runtime === 'default' && size === 'readable') {
          const source = readFileSync(join(out, 'main.mjs'), 'utf8');
          const ext = source.indexOf('from "./ext.mjs"');
          const setup = source.indexOf('import "./setup.mjs"');
          assert(ext >= 0 && setup >= 0);
          assert(variant === 'base' ? setup < ext : ext < setup);
        }
      }
      result.comparisons.push(comparison);
    }
  }
}
mkdirSync(join(root, 'results'), { recursive: true });
writeFileSync(join(root, 'results', 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log('Verified 3 native controls and 12 live base/head comparisons.');
console.log('Native source and base: value = 42. PR head: setup must run first.');

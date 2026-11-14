import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [revision, runtime] = process.argv.slice(2);
const key = revision.toUpperCase();
const core = process.env[key + '_CORE'];
const binding = process.env[key + '_BINDING'];
assert(core && binding, 'Set ' + key + '_CORE and ' + key + '_BINDING (see README.md)');
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = path.resolve(binding);
const { rspack } = await import(pathToFileURL(path.resolve(core)).href);
const fixtures = path.join(import.meta.dirname, 'fixtures');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-early-require-'));

function evaluate(file) {
  const script = `
    globalThis.order = [];
    try {
      const { z } = await import(process.argv[1]);
      console.log(JSON.stringify({ order: globalThis.order, z }));
    } catch (error) {
      console.log(JSON.stringify({ order: globalThis.order, error: error.message }));
      process.exitCode = 1;
    }`;
  const p = spawnSync(process.execPath, ['--input-type=module', '-e', script, pathToFileURL(file).href], { encoding: 'utf8' });
  if (p.error) throw p.error;
  assert(p.stdout.trim(), p.stderr || 'no output from the consumer');
  return { exit: p.status, ...JSON.parse(p.stdout) };
}

try {
  const external = ['./x.cjs', './z.mjs'];
  const compiler = rspack({
    mode: 'production', target: 'node', context: fixtures, entry: './index.mjs', devtool: false,
    experiments: runtime === 'rspack' ? { runtimeMode: 'rspack' } : {},
    externalsType: 'module', externals: Object.fromEntries(external.map(x => [x, x])),
    optimization: { minimize: false, splitChunks: false, runtimeChunk: false, moduleIds: 'named' },
    output: { path: output, filename: 'main.mjs', module: true, library: { type: 'modern-module' } }
  });
  const stats = await new Promise((resolve, reject) => compiler.run((err, result) => {
    compiler.close(closeErr => err || closeErr ? reject(err || closeErr) : resolve(result));
  }));
  assert(!stats.hasErrors(), stats.toString({ all: false, errors: true }));
  for (const file of external) fs.copyFileSync(path.join(fixtures, file), path.join(output, file));
  const code = fs.readFileSync(path.join(output, 'main.mjs'), 'utf8');
  const requests = code.split('\n').filter(line => /^(import |export .* from )/.test(line));
  if (process.env.CAPTURE_DIR) {
    const target = path.join(process.env.CAPTURE_DIR, revision, runtime);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'main.mjs'), code);
  }
  console.log(JSON.stringify({
    native: evaluate(path.join(fixtures, 'index.mjs')),
    bundle: evaluate(path.join(output, 'main.mjs')),
    requests
  }));
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}

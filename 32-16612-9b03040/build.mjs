import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [revision, layout] = process.argv.slice(2);
const key = revision.toUpperCase();
assert(['base', 'head'].includes(revision) && ['shared', 'separate'].includes(layout));
assert(process.env[key + '_CORE'] && process.env[key + '_BINDING'], 'set the build paths from README.md');
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = path.resolve(process.env[key + '_BINDING']);
const { rspack } = await import(pathToFileURL(path.resolve(process.env[key + '_CORE'])).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-mixed-dynamic-origins-'));
const src = path.join(tmp, 'src');
const out = path.join(tmp, 'dist');

function consume(file, loader) {
  const script = `globalThis.order = [];
    try {
      const api = await import(${JSON.stringify(pathToFileURL(file).href)});
      const { tag, x, z } = await api[${JSON.stringify(loader)}]();
      console.log(JSON.stringify({order: globalThis.order, tag, value: x ?? z}));
    } catch (e) {
      console.log(JSON.stringify({order: globalThis.order, error: e.message}));
      process.exitCode = 1;
    }`;
  const p = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  if (p.error || !p.stdout) throw p.error || Error(p.stderr || 'missing consumer result');
  return { exit: p.status, ...JSON.parse(p.stdout.trim()) };
}

try {
  fs.cpSync(path.join(import.meta.dirname, 'fixtures'), src, { recursive: true });
  fs.mkdirSync(out);
  if (layout === 'separate') {
    const entry = path.join(src, 'entry.mjs');
    const source = fs.readFileSync(entry, 'utf8');
    assert(source.includes('webpackChunkName: "shared"'));
    fs.writeFileSync(entry, source.replace('webpackChunkName: "shared"', 'webpackChunkName: "normal"'));
  }
  const externals = ['./setup.mjs', './x.mjs'];
  for (const file of externals) fs.copyFileSync(path.join(src, file), path.join(out, file));

  const compiler = rspack({
    context: src, entry: './entry.mjs', target: 'node', mode: 'production', devtool: false,
    externalsType: 'module', externals,
    optimization: { minimize: false, runtimeChunk: false, splitChunks: false, moduleIds: 'named', chunkIds: 'named' },
    output: { module: true, library: {type: 'modern-module'}, path: out, filename: '[name].mjs', chunkFilename: '[name].mjs' },
  });
  const stats = await new Promise((resolve, reject) =>
    compiler.run((error, stats) => compiler.close(closeError =>
      error || closeError ? reject(error || closeError) : resolve(stats))));
  if (stats.hasErrors()) throw Error(stats.toString({ all: false, errors: true }));

  const observe = entry => Object.fromEntries(['loadA', 'loadB'].map(loader => [loader, consume(entry, loader)]));
  const chunks = layout === 'shared' ? ['shared.mjs'] : ['shared.mjs', 'normal.mjs'];
  const declarations = {};
  for (const name of chunks) {
    declarations[name] = fs.readFileSync(path.join(out, name), 'utf8').split('\n')
      .filter(line => /^(?:import |export .* from )/.test(line));
  }
  console.log(JSON.stringify({ source: observe(path.join(src, 'entry.mjs')), bundle: observe(path.join(out, 'main.mjs')), declarations }));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

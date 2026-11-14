import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [revision, buildMode, scenario] = process.argv.slice(2);
const filename = scenario === "chunkhash" ? "[name].[chunkhash:8].mjs" : "[name].[contenthash:8].mjs";
const key = revision.toUpperCase();
const core = process.env[key + '_CORE'];
const binding = process.env[key + '_BINDING'];
assert(core && binding, 'Set the CORE and BINDING paths described in README.md');
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = path.resolve(binding);
const { rspack } = await import(pathToFileURL(path.resolve(core)).href);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-star-order-'));
const fixtures = path.join(import.meta.dirname, 'fixtures');
const out = path.join(root, 'dist');
const entry = path.join(root, 'entry.mjs');
const observed = [];
const recordDir = process.env.CAPTURE_DIR;
const copy = (file, dest) => fs.copyFileSync(path.join(fixtures, file), dest);
const change = name => copy('entry-' + name + '.mjs', entry);

function evaluate(file) {
  const probe = 'globalThis.trace=[]; const m=await import(' + JSON.stringify(pathToFileURL(file).href) +
    '); console.log(JSON.stringify({edited:m.edited===true,order:globalThis.trace,b:m.b,child:m.child}));';
  const p = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
  if (p.status !== 0) throw Error(p.stderr);
  return JSON.parse(p.stdout);
}

function configure() {
  return rspack({
    context: root, entry: './entry.mjs', mode: 'production', target: 'node',
    ...(scenario === "incremental" ? {cache: true, incremental: true} : {}),
    externalsType: 'module', externals: ['./A.mjs', './B.mjs'],
    optimization: { minimize: false, splitChunks: { chunks: 'all', cacheGroups: {
      shared: { test: /[\\/](?:child|inner)\.mjs$/, name: 'shared', enforce: true },
    } } },
    output: { path: out, filename, chunkFilename: filename,
      module: true, library: { type: 'modern-module' } },
  });
}
function inspect(stats, step) {
  if (stats.hasErrors()) throw Error(stats.toString());
  const assets = stats.toJson({all:false, chunks:true}).chunks.flatMap(c => c.files);
  const main = assets.find(name => name.startsWith('main.'));
  const shared = assets.find(name => name.startsWith('shared.'));
  const bundle = evaluate(path.join(out, main));
  // Ignore extra watcher notifications for the old build; wait for the public marker.
  if (bundle.edited !== (step === 1)) return false;
  const code = fs.readFileSync(path.join(out, shared), 'utf8');
  observed.push({ step, native: evaluate(entry), bundle, shared,
    declarations: code.split('\n').filter(s => /^(?:import |export .* from )/.test(s)) });
  if (recordDir) {
    const d = path.join(recordDir, revision, scenario, buildMode, String(step));
    fs.mkdirSync(d, {recursive:true});
    for (const name of [main,shared]) fs.copyFileSync(path.join(out,name), path.join(d,name));
  }
  return true;
}
const close = c => new Promise((res,rej) => c.close(e => e ? rej(e) : res()));
fs.mkdirSync(out);
for (const file of ['A.mjs','B.mjs','inner.mjs','child.mjs']) copy(file, path.join(root, file));
for (const file of ['A.mjs','B.mjs']) copy(file, path.join(out,file));
try {
  if (buildMode === 'cold') {
    for (const step of [0,1]) {
      change(step ? 'after' : 'before');
      for (const f of fs.readdirSync(out)) if (/^(?:main|shared)\./.test(f)) fs.unlinkSync(path.join(out,f));
      const c = configure();
      try { const s = await new Promise((res,rej) => c.run((e,s) => e ? rej(e) : res(s))); assert(inspect(s,step)); }
      finally { await close(c); }
    }
  } else {
    change('before');
    const c = configure();
    await new Promise((resolve,reject) => {
      let step = 0;
      let finished = false;
      const finish = err => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        watcher.close(e => (err || e) ? reject(err || e) : resolve());
      };
      const timeout = setTimeout(() => finish(Error('timed out waiting for the edited bundle')), 30000);
      const watcher = c.watch({aggregateTimeout:30}, (e,stats) => {
        if (finished) return;
        try {
          if (e) throw e;
          if (!inspect(stats, step)) return;
          if (step === 0) { step = 1; setTimeout(() => change('after'), 250); }
          else finish();
        } catch (error) { finish(error); }
      });
    }).finally(() => close(c));
  }
  console.log(JSON.stringify(observed));
} finally {
  fs.rmSync(root, {recursive:true,force:true});
}

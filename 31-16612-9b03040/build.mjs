import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [revision, runtime, declarationOrder] = process.argv.slice(2);
const prefix = revision.toUpperCase();
const core = process.env[prefix + '_CORE'];
const binding = process.env[prefix + '_BINDING'];
if (!core || !binding) throw new Error('Set ' + prefix + '_CORE and ' + prefix + '_BINDING to absolute paths');
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = binding;
const { rspack } = await import(pathToFileURL(core));
const context = path.join(import.meta.dirname, 'fixtures');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-16612-multientry-'));

function load(file) {
  const program = `
    globalThis.order = [];
    try {
      await import(${JSON.stringify(pathToFileURL(file).href)});
      console.log(JSON.stringify({ order: globalThis.order }));
    } catch (error) {
      console.log(JSON.stringify({ order: globalThis.order, error: error.message }));
      process.exitCode = 1;
    }
  `;
  const cp = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' });
  if (!cp.stdout.trim()) throw new Error(cp.stderr || 'Missing consumer output');
  return { exit: cp.status, ...JSON.parse(cp.stdout.trim()) };
}

try {
  const first = './first.mjs', second = './second.mjs';
  const compiler = rspack({
    mode: 'production', target: 'node', devtool: false, context,
    entry: declarationOrder === 'first-then-second' ? { first, second } : { second, first },
    externalsType: 'module', externals: { './z.mjs': './z.mjs' },
    output: {
      path: out, filename: '[name].mjs', chunkFilename: '[name].mjs',
      module: true, library: { type: 'modern-module' },
    },
    experiments: runtime === 'rspack' ? { runtimeMode: 'rspack' } : {},
    optimization: {
      minimize: false, runtimeChunk: false, chunkIds: 'named',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false, defaultVendors: false,
          twin: { test: /[\\/][ac]\.mjs$/, name: 'twin', enforce: true },
        },
      },
    },
  });
  await new Promise((resolve, reject) => compiler.run((err, stats) => compiler.close(closeErr =>
    err || closeErr || stats.hasErrors()
      ? reject(err || closeErr || new Error(stats.toString({ all: false, errors: true }))) : resolve()
  )));
  const files = fs.readdirSync(out).filter(f => f.endsWith('.mjs'));
  if (process.env.BUNDLE_DIR) {
    const dest = path.join(process.env.BUNDLE_DIR, revision, runtime, declarationOrder);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of files) fs.copyFileSync(path.join(out, f), path.join(dest, f));
  }
  fs.copyFileSync(path.join(context, 'z.mjs'), path.join(out, 'z.mjs'));
  const native = {}, bundle = {};
  for (const entry of ['first', 'second']) {
    native[entry] = load(path.join(context, entry + '.mjs'));
    bundle[entry] = load(path.join(out, entry + '.mjs'));
  }
  const requests = Object.fromEntries(['first', 'second'].map(e => [e,
    fs.readFileSync(path.join(out, e + '.mjs'), 'utf8').split('\n').filter(line => line.startsWith('import ')),
  ]));
  console.log(JSON.stringify({ native, bundle, requests }));
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

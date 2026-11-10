import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { rspack } = await import(process.env.RSPACK_CORE
  ? pathToFileURL(resolve(process.env.RSPACK_CORE)).href
  : '@rspack/core');
const [variant] = process.argv.slice(2);
if (!['base', 'pr'].includes(variant)) throw Error('Usage: node build.mjs <base|pr>');
const context = join(import.meta.dirname, 'src');
const out = join(import.meta.dirname, 'dist', variant);
mkdirSync(out, { recursive: true });
for (const name of ['ext.mjs', 'side.mjs']) copyFileSync(join(context, name), join(out, name));
const config = {
  mode: 'production', context, target: 'node', entry: './entry.mjs',
  externalsType: 'module', externals: ['./ext.mjs', './side.mjs'],
  optimization: {
    minimize: false,
  },
  output: { module: true, library: { type: 'modern-module' }, path: out,
    filename: '[name].mjs', chunkFormat: 'module' },
};
await new Promise((ok, fail) => rspack(config, (error, stats) =>
  error || stats.hasErrors() ? fail(error ?? Error(stats.toString())) : ok()
));

import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [variant, fixture, runtime = 'default', size = 'readable'] = process.argv.slice(2);
assert(['base', 'pr'].includes(variant));
assert(['lazy-require', 'require-resolve', 'eager-dynamic'].includes(fixture));
assert(['default', 'rspack'].includes(runtime));
assert(['readable', 'min'].includes(size));
assert(process.env.RSPACK_CORE, 'RSPACK_CORE must point to the built JS wrapper.');
const { rspack } = await import(pathToFileURL(resolve(process.env.RSPACK_CORE)).href);
const root = import.meta.dirname;
const context = join(root, 'fixtures', fixture);
const out = runtime === 'default' && size === 'readable'
  ? join(root, 'dist', variant, fixture)
  : join(root, '.work', runtime, size, variant, fixture);
mkdirSync(out, { recursive: true });
for (const name of ['ext.mjs', 'side.mjs']) {
  copyFileSync(join(context, name), join(out, name));
}
const config = {
  mode: 'production',
  context,
  target: 'node',
  entry: './entry.mjs',
  externalsType: 'module',
  externals: ['./ext.mjs', './side.mjs'],
  experiments: runtime === 'rspack' ? { runtimeMode: 'rspack' } : {},
  optimization: {
    minimize: size === 'min',
    splitChunks: {
      cacheGroups: {
        setup: { test: /setup\.mjs$/, chunks: 'all', name: 'setup', enforce: true },
      },
    },
  },
  output: {
    module: true,
    library: { type: 'modern-module' },
    path: out,
    filename: '[name].mjs',
    chunkFilename: '[name].mjs',
    chunkFormat: 'module',
  },
};
await new Promise((resolveBuild, rejectBuild) => {
  const compiler = rspack(config);
  compiler.run((error, stats) => compiler.close(closeError => {
    if (error || closeError || stats.hasErrors()) {
      rejectBuild(error ?? closeError ?? Error(stats.toString({ all: false, errors: true })));
    } else {
      resolveBuild();
    }
  }));
});

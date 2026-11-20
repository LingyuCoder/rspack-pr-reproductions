import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { rspack, sharing } = await import(pathToFileURL(process.env.RSPACK_CORE));
const require = createRequire(import.meta.url);
const variant = process.argv[2];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-mf-replace-'));
const outputPath = path.join(root, 'dist');
const packageDir = path.join(root, 'node_modules/compat-shared');
fs.mkdirSync(packageDir, { recursive: true });
fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({
  name: 'compat-shared', version: '1.0.0', main: 'index.js',
}));
fs.writeFileSync(path.join(packageDir, 'index.js'), "export const value = 'fallback-runtime-ok';\n");
fs.writeFileSync(path.join(root, 'index.js'), "import('compat-shared').then(m => console.log(m.value));\n");

const banner = '/* post-minification banner */\n';
const filename = '1.0.0/share-entry.js';
const observed = { variant, processing: null, fallback: null, value: null, error: null };
const plugin = {
  name: 'AddFallbackBanner',
  apply(compiler) {
    const { Compilation, sources } = compiler.rspack;
    const stage = variant === 'replace-late'
      ? Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER
      : Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1;
    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      compilation.hooks.processAssets.tap({ name: this.name, stage }, () => {
        const asset = compilation.getAsset(filename);
        if (!asset) return;
        const source = new sources.ConcatSource(banner, asset.source);
        if (variant === 'update-early') {
          compilation.updateAsset(filename, source);
        } else {
          compilation.deleteAsset(filename);
          compilation.emitAsset(filename, source, asset.info);
        }
        const chunk = compilation.namedChunks.get('compat-shared');
        observed.processing = {
          stage,
          assetExists: Boolean(compilation.getAsset(filename)),
          listedInChunk: Array.from(chunk.files).includes(filename),
        };
      });
    });
  },
};

let buildAssets;
const shared = { 'compat-shared': { requiredVersion: '*', treeShaking: { mode: 'server-calc' } } };
const compiler = rspack({
  mode: 'production', context: root, devtool: false, target: 'async-node', entry: './index.js',
  output: { path: outputPath, publicPath: '/', chunkFilename: '[id].js' },
  plugins: [
    plugin,
    new sharing.SharePlugin({ enhanced: true, shared }),
    new sharing.TreeShakingSharedPlugin({
      mfConfig: { name: 'asset_stage_compat', library: { type: 'commonjs-module' }, shared },
      onBuildAssets(data) { buildAssets = data; },
    }),
  ],
});

try {
  const stats = await new Promise((resolve, reject) => compiler.run((error, value) => error ? reject(error) : resolve(value)));
  if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
  const [entry, , globalName] = buildAssets['compat-shared'][0];
  observed.fallback = entry.split(path.sep).join('/');
  const target = path.join(outputPath, entry);
  if (!fs.readFileSync(target, 'utf8').startsWith(banner)) throw new Error('Expected the emitted asset to contain the banner.');
  observed.value = (await require(target)[globalName].get())().value;
} catch (error) {
  observed.error = error.message.match(/no files found for shared [^\n]+ chunk/)?.[0] ?? error.message;
} finally {
  await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('RESULT ' + JSON.stringify(observed));

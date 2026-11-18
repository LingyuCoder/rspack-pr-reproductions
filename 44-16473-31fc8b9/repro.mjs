import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import CompressionPlugin from 'compression-webpack-plugin';

const { rspack, sharing } = await import(pathToFileURL(process.env.RSPACK_CORE));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr16473-compression-'));
const sharedDir = path.join(root, 'node_modules/compat-shared');
fs.mkdirSync(sharedDir, { recursive: true });
fs.writeFileSync(path.join(sharedDir, 'package.json'), JSON.stringify({
  name: 'compat-shared', version: '1.0.0', main: 'index.js', sideEffects: false,
}));
fs.writeFileSync(path.join(sharedDir, 'index.js'), 'export const value = "SHARED_FALLBACK_OK";\n');
fs.writeFileSync(path.join(root, 'index.js'), 'import("compat-shared").then(m => console.log(m.value));\n');
const shared = { 'compat-shared': { requiredVersion: '*', treeShaking: { mode: 'server-calc' } } };
const deleteOriginalAssets = process.env.DELETE_ORIGINALS === 'true';
let callbackAssets = null;
const compiler = rspack({
  context: root, mode: 'production', target: 'web', devtool: false,
  entry: './index.js',
  output: { path: path.join(root, 'dist'), filename: '[name].js', publicPath: '/' },
  plugins: [
    new CompressionPlugin({ test: /\.js$/, deleteOriginalAssets }),
    new sharing.SharePlugin({ enhanced: true, shared }),
    new sharing.TreeShakingSharedPlugin({
      mfConfig: { name: 'compression_compat', shared },
      onBuildAssets: assets => { callbackAssets = assets; },
    }),
  ],
});
let error = null;
let statsErrors = [];
try {
  const stats = await new Promise((resolve, reject) => compiler.run((err, result) => err ? reject(err) : resolve(result)));
  statsErrors = stats.toJson({ all: false, errors: true }).errors ?? [];
} catch (err) {
  error = err.stack ?? String(err);
}
await new Promise(resolve => compiler.close(resolve));
const fallbackDir = path.join(root, 'dist/independent-packages/compat_shared/1.0.0');
const gzip = path.join(fallbackDir, 'share-entry.js.gz');
console.log('RESULT ' + JSON.stringify({
  deleteOriginalAssets, success: !error && !statsErrors.length,
  error, statsErrors, callbackAssets,
  fallbackFiles: fs.existsSync(fallbackDir) ? fs.readdirSync(fallbackDir).sort() : [],
  gzipContainsSharedValue: fs.existsSync(gzip) && gunzipSync(fs.readFileSync(gzip)).toString().includes('SHARED_FALLBACK_OK'),
}));
fs.rmSync(root, { recursive: true, force: true });

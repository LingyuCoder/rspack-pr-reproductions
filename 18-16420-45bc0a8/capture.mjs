import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const [binding, output] = process.argv.slice(2);
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = fs.realpathSync(binding);
const { rspack, SubresourceIntegrityPlugin } = await import(process.env.RSPACK_CORE);
const out = path.resolve(output);
const compiler = rspack({
  mode: 'production', target: 'web', context: path.join(here, 'src'),
  entry: { page: './page.js', other: './other.js' },
  output: { path: out, publicPath: '/', filename: '[name].js', chunkFilename: '[name].js', crossOriginLoading: 'anonymous' },
  optimization: { minimize: false, splitChunks: { chunks: 'all', cacheGroups: {
    shared: { test: /[\\/]shared\.js$/, name: 'shared', enforce: true }
  } } },
  plugins: [new SubresourceIntegrityPlugin({hashFuncNames:['sha256'], hashLoading:'lazy'})],
});
const stats = await new Promise((ok, fail) => compiler.run((err, stats) => err ? fail(err) : ok(stats)));
await new Promise((ok, fail) => compiler.close(err => err ? fail(err) : ok()));
assert(!stats.hasErrors(), stats.toString({all:false, errors:true}));
const entries = stats.toJson({ all:false, entrypoints:true }).entrypoints;
const initial = entries.page.assets.map(asset => asset.name);
const expected = 'sha256-' + createHash('sha256').update(fs.readFileSync(path.join(out, 'leaf.js'))).digest('base64');
const browser = await chromium.launch({executablePath: process.env.CHROME_BIN, channel: process.env.CHROME_BIN ? undefined : 'chrome'});
try {
  const tests = [];
  for (const tamper of [false, true]) {
    const page = await browser.newPage();
    await page.route('https://example.test/**', async route => {
      const file = new URL(route.request().url()).pathname.slice(1);
      if (!file) {
        return route.fulfill({contentType:'text/html',body:initial.map(name => '<script src="/'+name+'"></script>').join('')});
      }
      assert.match(file, /^\w+\.js$/);
      let body = fs.readFileSync(path.join(out,file),'utf8');
      if (file === 'leaf.js' && tamper) body += '\nglobalThis.tampered = true;';
      return route.fulfill({contentType:'application/javascript',body});
    });
    await page.goto('https://example.test/');
    const observation = await page.evaluate(async () => {
      const append = document.head.appendChild.bind(document.head);
      let integrity;
      document.head.appendChild = el => {
        if (el.tagName === 'SCRIPT') integrity = el.integrity;
        return append(el);
      };
      let value = null, error = null;
      try { value = (await globalThis.load()).default; } catch (e) { error = e.name; }
      return {integrity, value, error, tamperedCodeRan:globalThis.tampered === true};
    });
    tests.push({tamper, ...observation});
    await page.close();
  }
  console.log(JSON.stringify({browser:await browser.version(), initial, expected, tests},null,2));
} finally { await browser.close(); }

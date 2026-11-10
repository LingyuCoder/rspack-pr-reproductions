const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { rspack } = require(process.env.RSPACK_CORE || '@rspack/core');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nosources-vendor-'));
process.env.RSPACK_OBSERVE_MAP = dir;
fs.writeFileSync(path.join(dir, 'entry.js'), '');
const c = rspack({
  mode: 'none', cache: false, devtool: 'nosources-source-map',
  context: dir, entry: './entry.js', output: {path: path.join(dir, 'out')},
  plugins: [{apply(compiler) {
    compiler.hooks.thisCompilation.tap('Vendor', compilation => {
      compilation.hooks.processAssets.tap({name: 'Vendor', stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS}, () => {
        const vendor = process.env.VENDOR_JS;
        const js = vendor ? fs.readFileSync(vendor, 'utf8') : 'console.log(1);';
        const map = vendor ? JSON.parse(fs.readFileSync(vendor + '.map', 'utf8')) : {
          version: 3, sources: ['vendor.ts'], names: [], mappings: 'AAAA',
          sourcesContent: ['/*' + 'untranspiled '.repeat(650000) + '*/\nconsole.log(1);']
        };
        compilation.emitAsset('vendor.js', new rspack.sources.SourceMapSource(js, 'vendor.js', map));
      });
    });
    compiler.hooks.afterEmit.tapPromise('Check', async () => {
      const read = name => fs.readFileSync(path.join(dir, 'out', name));
      const js = read('vendor.js'), map = read('vendor.js.map');
      assert.ok(js.toString().includes('sourceMappingURL=vendor.js.map'));
      const parsed = JSON.parse(map);
      assert.equal('sourcesContent' in parsed, false);
      assert.ok(parsed.sources.length && parsed.mappings.length);
      fs.writeFileSync(path.join(dir, 'observe'), '');
      for (let i = 0; i < 1000 && !fs.existsSync(path.join(dir, 'observed')); i++) {
        await new Promise(r => setTimeout(r, 10));
      }
      const [refs, original, allocation, state] = fs.readFileSync(path.join(dir, 'observed'), 'utf8').split(' ');
      const sha = x => crypto.createHash('sha256').update(x).digest('hex');
      console.log(JSON.stringify({ refs: +refs, original: +original, allocation: +allocation, state, js: sha(js), map: sha(map) }));
    });
  }}]
});
c.run((err, stats) => {
  if (err || stats.hasErrors()) throw err || Error(stats.toString());
  c.close(() => fs.rmSync(dir, {recursive: true, force: true}));
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const engines = ['base', 'pr', 'webpack'];

async function worker(engine) {
  let binding;
  if (engine !== 'webpack') {
    binding = fs.realpathSync(process.env[engine.toUpperCase() + '_BINDING']
      ?? path.join(here, '.bindings', engine, 'rspack.darwin-arm64.node'));
    process.env.NAPI_RS_NATIVE_LIBRARY_PATH = binding;
  }
  // webpack's Node client honors these even for loopback URLs.
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
  const bundle = engine === 'webpack' ? require('webpack') : require('@rspack/core').rspack;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-http-repro-'));
  const lockfileLocation = path.join(tmp, 'remote.lock');
  const entry = path.join(tmp, 'entry.cjs');
  const output = path.join(tmp, 'dist', 'main.cjs');
  let requests = [];
  let target = '/v1.js';
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === '/latest.js') {
      res.writeHead(302, { location: target, 'cache-control': 'must-revalidate' });
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'application/javascript',
      'cache-control': target === '/v1.js' ? 'must-revalidate' : 'max-age=3600' });
    res.end('export default ' + JSON.stringify(req.url === '/v2.js' ? 'v2' : 'v1') + ';\n');
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const select = (resource) => fs.writeFileSync(entry,
      'module.exports = require(' + JSON.stringify(origin + resource) + ').default;\n');
    const compiler = (frozen = false, upgrade = true) => bundle({
      context: tmp, mode: 'none', target: 'node', cache: false, entry: './entry.cjs',
      output: { path: path.dirname(output), filename: 'main.cjs', library: { type: 'commonjs2' } },
      experiments: { buildHttp: {
        allowedUris: [origin + '/'], lockfileLocation, cacheLocation: lockfileLocation + '.data',
        upgrade, frozen
      } }
    });
    async function build(c, close = true) {
      requests = [];
      c.inputFileSystem?.purge?.();
      const stats = await new Promise((resolve, reject) =>
        c.run((err, value) => err ? reject(err) : resolve(value)));
      if (close) await new Promise((resolve, reject) =>
        c.close(err => err ? reject(err) : resolve()));
      if (binding) assert.ok(require.cache[binding], 'expected CI binding did not load');
      const errors = stats.toJson({ all: false, errors: true }).errors.map(e => e.message.trim());
      let value = null;
      if (!errors.length) {
        delete require.cache[require.resolve(output)];
        value = require(output);
      }
      return { value, requests: [...requests], errors };
    }
    const lockedTarget = () => {
      const lock = JSON.parse(fs.readFileSync(lockfileLocation, 'utf8'));
      const resource = origin + '/latest.js';
      return new URL((lock.entries ?? lock)[resource].resolved ?? resource).pathname;
    };
    select('/latest.js');
    const seed = await build(compiler());
    assert.equal(seed.value, 'v1');
    assert.equal(lockedTarget(), '/v1.js');

    target = '/v2.js';
    const c = compiler();
    select('/v1.js');
    const pinned = await build(c, false);
    assert.equal(pinned.value, 'v1');
    assert.ok(pinned.requests.includes('/v1.js'));

    // Keep the same compiler while the entry switches to the floating alias.
    select('/latest.js');
    const latest = await build(c);
    const locked = lockedTarget();
    const coldControl = await build(compiler());
    return { pinned, latest, locked, freshCompilerValue: coldControl.value };
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--worker') {
  console.log(JSON.stringify(await worker(process.argv[3])));
} else {
  const observed = {};
  for (const engine of engines) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', engine],
      { encoding: 'utf8', cwd: here });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    observed[engine] = JSON.parse(child.stdout);
  }
  for (const [engine, result] of Object.entries(observed)) {
    const expected = engine === 'pr' ? 'v1' : 'v2';
    assert.deepEqual(result.latest.errors, []);
    assert.equal(result.latest.value, expected);
    assert.equal(result.locked, '/' + expected + '.js');
    assert.deepEqual(result.latest.requests, engine === 'pr' ? [] : ['/latest.js', '/v2.js']);
    assert.equal(result.freshCompilerValue, 'v2');
  }
  console.log(JSON.stringify(observed, null, 2));
  if (process.argv.includes('--record'))
    fs.writeFileSync(path.join(here, 'observed.json'), JSON.stringify(observed, null, 2) + '\n');
}

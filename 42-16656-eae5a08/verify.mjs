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
  let unavailable = false;
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (unavailable) {
      res.writeHead(503);
      return res.end('origin unavailable');
    }
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'max-age=3600' });
    res.end('export default "v1";\n');
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
    select('/v1.js');
    const seed = await build(compiler());
    assert.equal(seed.value, 'v1');
    assert.ok(seed.requests.includes('/v1.js'));
    const savedLock = fs.readFileSync(lockfileLocation, 'utf8');

    unavailable = true;
    const cold = await build(compiler(true, true));
    const noUpgrade = await build(compiler(true, false));
    assert.equal(fs.readFileSync(lockfileLocation, 'utf8'), savedLock);
    return { cold, noUpgrade };
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
    assert.deepEqual(result.noUpgrade, { value: 'v1', requests: [], errors: [] });
    assert.equal(result.cold.value, engine === 'pr' ? null : 'v1');
    assert.deepEqual(result.cold.requests, engine === 'base' ? [] : ['/v1.js']);
    if (engine === 'pr') assert.match(result.cold.errors.join('\n'), /Request failed with status: 503/);
    else assert.deepEqual(result.cold.errors, []);
  }
  console.log(JSON.stringify(observed, null, 2));
  if (process.argv.includes('--record'))
    fs.writeFileSync(path.join(here, 'observed.json'), JSON.stringify(observed, null, 2) + '\n');
}

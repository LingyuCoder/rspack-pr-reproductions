import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const engine = process.argv[2];
assert.equal(process.platform, 'linux', 'The base comparison uses Linux inotify.');
const engines = ['base', 'pr', 'watchpack'];

if (!engine) {
  const rows = engines.flatMap(name => JSON.parse(execFileSync(process.execPath,
    [fileURLToPath(import.meta.url), name], { encoding: 'utf8', timeout: 25000 })));
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, rows }, null, 2));
} else {
  assert(engines.includes(engine));
  const native = engine !== 'watchpack';
  const Watcher = native ? require(process.env[engine.toUpperCase() + '_BINDING'] ||
    path.join(here, '.bindings', engine, 'rspack.linux-x64-gnu.node')).NativeWatcher : require('watchpack');
  if (!native) assert.equal(require('watchpack/package.json').version, '2.6.3');
  const rows = [];
  for (const registerLink of [false, true]) rows.push(await run(registerLink));
  console.log(JSON.stringify(rows));

  async function run(registerLink) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-dir-link-dep-'));
    const app = path.join(root, 'app');
    const target = path.join(root, 'target');
    const link = path.join(app, 'link');
    const alias = path.join(link, 'value.js');
    const value = path.join(target, 'value.js');
    const witness = path.join(app, 'witness.js');
    fs.mkdirSync(app);
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, 'dir');
    const old = new Date(Date.now() - 120000);
    for (const f of [value, witness]) {
      fs.writeFileSync(f, 'before');
      fs.utimesSync(f, old, old);
    }
    fs.lutimesSync(link, old, old);
    for (const f of [app, target]) fs.utimesSync(f, old, old);

    const watcher = new Watcher({ followSymlinks: true, aggregateTimeout: 40 });
    const changed = new Set(), removed = new Set(), immediate = new Set(), errors = [];
    const files = registerLink ? [link] : [];
    const startTime = Date.now();
    const record = (c, r) => { for (const f of c) changed.add(f); for (const f of r) removed.add(f); };
    const clear = () => { changed.clear(); removed.clear(); immediate.clear(); };
    const relative = paths => [...paths].map(f => path.relative(root, f)).sort();
    const stamp = () => native
      ? watcher.collectTimeInfoEntries().fileTimestamps.entries.find(e => e.path === alias)?.timestamp
      : watcher.getTimeInfoEntries().get(alias)?.timestamp;
    try {
      if (native) {
        watcher.watch([files, []], [[app], []], [[], []], BigInt(startTime),
          (err, batch) => err ? errors.push(String(err)) : record(batch.changedFiles, batch.removedFiles),
          event => immediate.add(event.path));
      } else {
        watcher.on('aggregated', record);
        watcher.on('change', f => immediate.add(f));
        watcher.watch({ files, directories: [app], startTime });
      }
      await until(() => typeof stamp() === 'number');
      // Bracket the target edit with edits known to reach this same watcher.
      fs.writeFileSync(witness, 'ready');
      await until(() => immediate.has(witness) && changed.has(app));
      const before = stamp();
      clear();
      fs.writeFileSync(value, 'changed target');
      await sleep(1200);
      assert.equal(fs.readFileSync(alias, 'utf8'), 'changed target');
      const row = { engine, registerLink, changes: relative(changed), raw: relative(immediate),
        removals: relative(removed), timestampAdvanced: stamp() !== before };
      clear();
      fs.writeFileSync(witness, 'still watching');
      await until(() => immediate.has(witness) && changed.has(app));
      row.witness = relative(changed);
      const notified = engine === 'base' ? registerLink : engine === 'pr' ? !registerLink : true;
      assert.deepEqual(row.changes, notified ? ['app'] : []);
      assert.deepEqual(row.raw, notified ? ['app/link/value.js'] : []);
      assert.deepEqual(row.removals, []);
      assert.equal(row.timestampAdvanced, notified);
      assert.deepEqual(row.witness, ['app']);
      assert.deepEqual(errors, []);
      return row;
    } finally {
      await watcher.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

async function until(test) {
  const limit = Date.now() + 6000;
  while (!test() && Date.now() < limit) await sleep(20);
  assert(test(), 'watcher did not finish setup or deliver the witness edit');
}

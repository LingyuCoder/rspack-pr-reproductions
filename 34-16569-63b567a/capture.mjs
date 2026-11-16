import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const engine = process.argv[2];
assert.ok(['base', 'pr', 'watchpack'].includes(engine));
const native = engine !== 'watchpack';
const binding = process.env[engine === 'base' ? 'BASE_BINDING' : 'PR_BINDING'];
const Watcher = native ? require(path.resolve(binding)).NativeWatcher : require('watchpack');
async function waitFor(check) {
  const deadline = Date.now() + 6000;
  while (!check() && Date.now() < deadline) await sleep(30);
  assert.ok(check(), 'watcher did not reach the readiness/control condition');
}
async function capture(scenario) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rspack-live-contexts-'));
  const app = path.join(root, 'app');
  const target = path.join(root, 'target');
  const real = path.join(target, 'value.js');
  const link = path.join(app, 'link');
  const alias = path.join(link, 'value.js');
  const witness = path.join(app, 'witness.js');
  const dirs = scenario === 'parent-only' ? [app] : [app, link];
  const rel = p => path.relative(root, p).split(path.sep).join('/');
  const changes = new Set(), removals = new Set(), errors = [];
  const record = (changed, removed) => {
    for (const entry of changed) changes.add(rel(entry));
    for (const entry of removed) removals.add(rel(entry));
  };
  let watcher;
  try {
    fs.mkdirSync(app);
    fs.mkdirSync(target);
    fs.writeFileSync(witness, 'before');
    fs.writeFileSync(real, 'before');
    fs.symlinkSync(target, link, 'dir');
    await sleep(2200);
    watcher = new Watcher({
      followSymlinks: true, aggregateTimeout: 50,
      ignored: entry => scenario !== 'no-ignore' && entry === real,
    });
    const start = Date.now();
    if (native) {
      watcher.watch([[], []], [dirs, []], [[], []], BigInt(start),
        (err, batch) => err ? errors.push(err.message) : record(batch.changedFiles, batch.removedFiles), () => {});
    } else {
      watcher.on('aggregated', record);
      watcher.watch({ directories: dirs, startTime: start });
    }
    // These entries exist only once the parent context has been scanned.
    const ready = () => {
      const entries = native
        ? watcher.collectTimeInfoEntries().fileTimestamps.entries.map(e => e.path)
        : [...watcher.getTimeInfoEntries().keys()];
      return entries.includes(witness) && entries.includes(alias);
    };
    await waitFor(ready);
    await sleep(350);
    changes.clear(); removals.clear();
    fs.writeFileSync(real, 'live target edit');
    await sleep(1500);
    const targetEdit = [...changes].sort();
    const targetRemovals = [...removals].sort();
    changes.clear(); removals.clear();
    // Positive control on the same watcher: the original app subscription is live.
    fs.writeFileSync(witness, 'ordinary edit');
    await waitFor(() => changes.has('app'));
    return { scenario, directories: dirs.map(rel), contentsViaAlias: fs.readFileSync(alias, 'utf8'),
      targetEdit, targetRemovals, ordinaryEdit: [...changes].sort(), errors };
  } finally {
    if (watcher) await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const observations = [];
for (const scenario of ['overlap', 'parent-only', 'no-ignore']) observations.push(await capture(scenario));
process.stdout.write(JSON.stringify({ engine, node: process.version, platform: process.platform, arch: process.arch,
  ...(native ? { sha256: createHash('sha256').update(fs.readFileSync(binding)).digest('hex') }
    : { version: require('watchpack/package.json').version }), observations }, null, 2) + '\n');

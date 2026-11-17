import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const binding = (engine) => process.env[engine.toUpperCase() + '_BINDING']
  || path.join(here, '.bindings', engine, 'rspack.darwin-arm64.node');
const until = async (predicate) => {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await sleep(20);
  assert.ok(predicate(), 'timed out waiting for the control edit');
};

async function capture(engine, scenario) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'watch-ignored-dir-'));
  const app = path.join(root, 'app');
  const dist = path.join(app, 'dist');
  const witness = path.join(app, 'witness.js');
  const missing = path.join(dist, 'entry.js');
  fs.mkdirSync(app);
  fs.writeFileSync(witness, 'before');
  const old = new Date('2021-01-01T00:00:00Z');
  fs.utimesSync(witness, old, old);
  fs.utimesSync(app, old, old);
  const options = { aggregateTimeout: 35, ignored: (entry) => entry === dist };
  if (scenario === 'follow') options.followSymlinks = true;
  const watchedMissing = scenario === 'no-missing' ? [] : [missing];
  const isWatchpack = engine === 'watchpack';
  const watcher = isWatchpack ? new (require('watchpack'))(options)
    : new (require(binding(engine)).NativeWatcher)(options);
  const changes = new Set(), removals = new Set(), immediate = new Set();
  let error;
  const collect = (changed, removed) => {
    for (const x of changed) changes.add(x);
    for (const x of removed) removals.add(x);
  };
  const clear = () => { changes.clear(); removals.clear(); immediate.clear(); };
  const relative = (values) => [...values].map((p) => path.relative(root, p)).sort();
  try {
    const startTime = Date.now();
    if (isWatchpack) {
      watcher.on('aggregated', collect);
      watcher.on('change', (p) => immediate.add(p));
      watcher.watch({ directories: [app], missing: watchedMissing, startTime });
    } else {
      watcher.watch([[], []], [[app], []], [watchedMissing, []], BigInt(startTime),
        (e, batch) => { if (e) error = e; else collect(batch.changedFiles, batch.removedFiles); },
        (e) => immediate.add(e.path));
    }
    await sleep(600);
    clear();
    fs.appendFileSync(witness, ' ready');
    await until(() => changes.has(app) && immediate.has(witness));
    await sleep(180);
    clear();
    fs.mkdirSync(dist); // entry.js is never created.
    await sleep(2000);
    const observed = {
      engine, scenario, missingStillAbsent: !fs.existsSync(missing),
      changed: relative(changes), removed: relative(removals), immediate: relative(immediate),
    };
    assert.equal(observed.missingStillAbsent, true);
    // Prove the watcher remains live after the observation window.
    clear();
    fs.appendFileSync(witness, ' finished');
    await until(() => changes.has(app) && immediate.has(witness));
    if (error) throw error;
    return observed;
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const matrix = [
  ['base', 'default', []],
  ['pr', 'default', ['app']],
  ['watchpack', 'default', []],
  ['pr', 'no-missing', []],
  ['pr', 'follow', []],
];
const cli = process.argv.slice(2);
if (cli[0] === '--capture') {
  console.log(JSON.stringify(await capture(cli[1], cli[2])));
} else {
  const observations = [];
  for (const [engine, scenario, expected] of matrix) {
    // Load each native library in a fresh process, with its own watcher and folder.
    const child = spawnSync(process.execPath,
      [fileURLToPath(import.meta.url), '--capture', engine, scenario],
      { encoding: 'utf8', timeout: 18000 });
    if (child.error) throw child.error;
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const observation = JSON.parse(child.stdout.trim());
    assert.deepEqual(observation.changed, expected, JSON.stringify(observation));
    assert.deepEqual(observation.removed, [], JSON.stringify(observation));
    observations.push(observation);
    console.log(engine, scenario, '=>', JSON.stringify(observation.changed));
  }
  if (cli.includes('--record')) {
    const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const result = {
      platform: process.platform, arch: process.arch, osRelease: os.release(), node: process.version,
      watchpack: require('watchpack/package.json').version,
      bindingSha256: { base: sha256(binding('base')), pr: sha256(binding('pr')) },
      observations,
    };
    fs.writeFileSync(path.join(here, 'observed.json'), JSON.stringify(result, null, 2) + '\n');
  }
}

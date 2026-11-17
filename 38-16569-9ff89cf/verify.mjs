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
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'watch-replace-link-'));
  const file = (p) => path.join(root, p);
  for (const d of ['app', 'targets', 'staging']) fs.mkdirSync(file(d));
  const alias = file('app/link.js'), witness = file('app/witness.js');
  const next = file('staging/next-link');
  const first = file('targets/a.js'), second = file('targets/b.js');
  const old = new Date('2021-01-01T00:00:00Z');
  const later = new Date('2021-02-01T00:00:00Z');
  for (const [p, c, t] of [[first, 'A', old], [second, 'B', later], [witness, 'witness', old]]) {
    fs.writeFileSync(p, c);
    fs.utimesSync(p, t, t);
  }
  fs.symlinkSync(first, alias);
  fs.lutimesSync(alias, old, old);
  fs.symlinkSync(second, next);
  if (scenario === 'preserved') fs.lutimesSync(next, old, old);
  const options = { aggregateTimeout: 35, followSymlinks: true };
  const isWatchpack = engine === 'watchpack';
  const watcher = isWatchpack ? new (require('watchpack'))(options)
    : new (require(binding(engine)).NativeWatcher)(options);
  const changes = new Set(), removals = new Set();
  let error;
  const collect = (changed, removed) => {
    for (const x of changed) changes.add(x);
    for (const x of removed) removals.add(x);
  };
  const relative = (values) => [...values].filter((p) => p !== witness)
    .map((p) => path.relative(root, p)).sort();
  try {
    const startTime = Date.now();
    if (isWatchpack) {
      watcher.on('aggregated', collect);
      watcher.watch({ files: [alias, witness], startTime });
    } else {
      watcher.watch([[alias, witness], []], [[], []], [[], []], BigInt(startTime),
        (e, batch) => { if (e) error = e; else collect(batch.changedFiles, batch.removedFiles); },
        () => {});
    }
    await sleep(600);
    changes.clear();
    fs.appendFileSync(witness, ' ready');
    await until(() => changes.has(witness));
    await sleep(180);
    changes.clear(); removals.clear();
    const before = fs.lstatSync(alias).mtimeMs;
    assert.equal(fs.readFileSync(alias, 'utf8'), 'A');
    fs.renameSync(next, alias);
    const sameLinkMtime = fs.lstatSync(alias).mtimeMs === before;
    assert.equal(sameLinkMtime, scenario === 'preserved');
    assert.notEqual(fs.statSync(first).mtimeMs, fs.statSync(second).mtimeMs);
    assert.equal(fs.readFileSync(alias, 'utf8'), 'B');
    await sleep(2000);
    // A second ordinary file event confirms that callbacks are still being delivered.
    fs.appendFileSync(witness, ' finished');
    await until(() => changes.has(witness));
    await sleep(150);
    if (error) throw error;
    return { engine, scenario, sameLinkMtime, targetContent: 'B',
      changed: relative(changes), removed: relative(removals) };
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const matrix = [
  ['base', 'preserved', ['app/link.js']],
  ['pr', 'preserved', []],
  ['watchpack', 'preserved', []],
  ['pr', 'fresh', ['app/link.js']],
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

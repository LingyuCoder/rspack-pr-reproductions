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
const binding = process.env[engine === 'base' ? 'BASE_BINDING' : 'PR_BINDING'];
const native = engine !== 'watchpack';
const Watcher = native ? require(path.resolve(binding)).NativeWatcher : require('watchpack');

async function capture(scenario) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rspack-context-file-'));
  const app = path.join(root, 'app');
  const target = path.join(root, 'target');
  const link = path.join(app, 'link');
  const real = path.join(target, 'value.js');
  const alias = path.join(link, 'value.js');
  const relative = p => path.relative(root, p).split(path.sep).join('/');
  const relativeList = paths => [...paths].map(relative).sort();
  const files = scenario === 'context-only' ? [] : [alias];
  const directories = scenario === 'file-only' ? [] : [app];
  let watcher;
  try {
    fs.mkdirSync(app);
    fs.mkdirSync(target);
    fs.writeFileSync(real, 'before');
    const old = new Date(Date.now() - 60000);
    fs.utimesSync(real, old, old);
    fs.symlinkSync(target, link, 'junction');
    // Age the link and directory timestamps beyond the watcher's 2 s accuracy window.
    await sleep(2200);
    const startTime = Date.now();
    const firstRead = fs.readFileSync(alias, 'utf8');
    await sleep(50);
    fs.writeFileSync(real, 'after');
    const mtime = fs.statSync(real).mtimeMs;
    assert.ok(mtime > startTime);
    // The build continues after the write; flush/coalesce any pre-registration OS events.
    await sleep(1600);
    watcher = new Watcher({
      aggregateTimeout: 50,
      followSymlinks: true,
      ignored: p => scenario !== 'without-ignore' && (p === target || p.startsWith(target + path.sep)),
    });
    const changes = new Set();
    const removals = new Set();
    const errors = [];
    const record = (changed, removed) => {
      for (const p of changed) changes.add(p);
      for (const p of removed) removals.add(p);
    };
    if (native) {
      watcher.watch([files, []], [directories, []], [[], []], BigInt(startTime),
        (error, batch) => error ? errors.push(error.message) : record(batch.changedFiles, batch.removedFiles), () => {});
    } else {
      watcher.on('aggregated', record);
      watcher.watch({ files, directories, startTime });
    }
    // From registration through the observation below, nothing is written to the fixture.
    await sleep(1500);
    const known = native
      ? watcher.collectTimeInfoEntries().fileTimestamps.entries.map(e => e.path)
      : [...watcher.getTimeInfoEntries().keys()];
    return { scenario, files: relativeList(files), directories: relativeList(directories),
      startTime, mtime, firstRead, lastRead: fs.readFileSync(alias, 'utf8'),
      changes: relativeList(changes), removals: relativeList(removals), aliasIndexed: known.includes(alias), errors };
  } finally {
    if (watcher) await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const scenarios = ['both', 'context-only', 'file-only', 'without-ignore'];
const observations = [];
for (const scenario of scenarios) observations.push(await capture(scenario));
const result = { engine, node: process.version, platform: process.platform, arch: process.arch,
  ...(native ? { sha256: createHash('sha256').update(fs.readFileSync(binding)).digest('hex') }
    : { version: require('watchpack/package.json').version }), observations };
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

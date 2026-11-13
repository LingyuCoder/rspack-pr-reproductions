import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const label = process.argv[2];
if (!['base', 'pr', 'watchpack'].includes(label)) {
  throw new Error('Usage: node capture.mjs base|pr|watchpack');
}
const native = label !== 'watchpack';
const binding = process.env.RSPACK_BINDING;
if (native && (!binding || !process.env.RSPACK_BINDING_SOURCE_SHA)) {
  throw new Error('Set RSPACK_BINDING and RSPACK_BINDING_SOURCE_SHA for a native capture');
}
const Watcher = native ? require(path.resolve(binding)).NativeWatcher : require('watchpack');

async function capture(scenario) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'rspack-overlap-'));
  const app = path.join(root, 'app');
  const target = path.join(root, 'target');
  const link = path.join(app, 'link');
  const file = path.join(target, 'value.js');
  const alias = path.join(link, 'value.js');
  fs.mkdirSync(app);
  fs.mkdirSync(target);
  fs.writeFileSync(file, 'initial contents');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(file, old, old);
  fs.symlinkSync(target, link, 'junction');
  await sleep(2200);

  // Model a build reading the old file, then the file changing before watch setup.
  const startTime = Date.now();
  const contentsAtBuildStart = fs.readFileSync(alias, 'utf8');
  await sleep(50);
  fs.writeFileSync(file, 'edited during build');
  const changedMtime = fs.statSync(file).mtimeMs;
  const relative = value => path.relative(root, value).split(path.sep).join('/');
  const ignoredCalls = new Set();
  const watcher = new Watcher({
    followSymlinks: true,
    aggregateTimeout: 50,
    ignored(entry) {
      if (entry === root || entry.startsWith(root + path.sep)) {
        ignoredCalls.add(relative(entry));
      }
      return entry === target || entry.startsWith(target + path.sep);
    },
  });
  const directories = scenario === 'overlap' ? [app, link]
    : scenario === 'nested-only' ? [app] : [link];
  const changed = new Set();
  const removed = new Set();
  const events = [];
  const batches = [];
  const errors = [];
  const record = (changes, removals) => {
    const batch = { changes: [...changes].map(relative).sort(), removals: [...removals].map(relative).sort() };
    batches.push(batch);
    for (const value of batch.changes) changed.add(value);
    for (const value of batch.removals) removed.add(value);
  };
  try {
    if (native) {
      watcher.watch([[], []], [directories, []], [[], []], BigInt(startTime), (error, result) => {
        if (error) errors.push(error.message);
        else record(result.changedFiles, result.removedFiles);
      }, event => events.push({ kind: event.kind, path: relative(event.path), mtime: event.mtime }));
    } else {
      watcher.on('aggregated', record);
      watcher.on('change', (entry, mtime) => events.push({ kind: 'change', path: relative(entry), mtime }));
      watcher.on('remove', entry => events.push({ kind: 'remove', path: relative(entry) }));
      watcher.watch({ files: [], directories, missing: [], startTime });
    }
    // There are deliberately no filesystem mutations after watch() starts.
    await sleep(1200);
    const timestamps = native
      ? watcher.collectTimeInfoEntries().fileTimestamps.entries.map(entry => entry.path)
      : [...watcher.getTimeInfoEntries().keys()];
    return {
      scenario,
      directories: directories.map(relative),
      ignored: 'target and descendants; app/link and its descendants are allowed',
      startTime,
      changedMtime,
      contentsAtBuildStart,
      contentsAtWatch: fs.readFileSync(alias, 'utf8'),
      filesystemMutationAfterWatch: null,
      changedFiles: [...changed].sort(),
      removedFiles: [...removed].sort(),
      aliasTimestampRecorded: timestamps.includes(alias),
      timestamps: timestamps.map(relative).sort(),
      errors,
      ignoredCalls: [...ignoredCalls].sort(),
      events,
      batches,
    };
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const results = [];
for (const scenario of ['overlap', 'nested-only', 'explicit-only']) {
  results.push(await capture(scenario));
}
const report = {
  label,
  capturedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ...(native ? {
    bindingFile: path.basename(binding),
    bindingSourceSha: process.env.RSPACK_BINDING_SOURCE_SHA,
    bindingSha256: createHash('sha256').update(fs.readFileSync(binding)).digest('hex'),
  } : { version: require('watchpack/package.json').version }),
  results,
};
fs.mkdirSync(new URL('results/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`results/${label}.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
for (const result of results) {
  console.log(`${label}/${result.scenario}: changes=${JSON.stringify(result.changedFiles)}, timestamp=${result.aliasTimestampRecorded}`);
}

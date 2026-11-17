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
const [engine, mode] = process.argv.slice(2);
assert.equal(process.platform, 'linux', 'The reproduction uses Linux inotify rename events.');
if (!engine) {
  const rows = [['base', 'same'], ['pr', 'same'], ['pr', 'no-follow'], ['pr', 'new-mtime']].map(args =>
    JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...args],
      { encoding: 'utf8', timeout: 20000 })));
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, rows }, null, 2));
} else {
  const { NativeWatcher } = require(process.env[engine.toUpperCase() + '_BINDING'] ||
    path.join(here, '.bindings', engine, 'rspack.linux-x64-gnu.node'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-parent-move-'));
  const app = path.join(root, 'app');
  const tree = path.join(app, 'assets');
  const next = path.join(root, 'next');
  const file = path.join(tree, 'nested/value.js');
  const replacement = path.join(next, 'nested/value.js');
  const witness = path.join(app, 'witness.js');
  const old = Math.floor(Date.now() / 1000) - 120;
  for (const [name, value, mtime] of [[file, 'old content', old],
    [replacement, 'different content', mode === 'new-mtime' ? old + 10 : old],
    [witness, 'before', old]]) {
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, value);
    fs.utimesSync(name, mtime, mtime);
  }
  const watcher = new NativeWatcher({ followSymlinks: mode !== 'no-follow', aggregateTimeout: 40 });
  const changed = new Set(), removed = new Set(), errors = [];
  const relative = paths => [...paths].map(p => path.relative(root, p)).sort();
  const stamp = () => {
    const table = watcher.collectTimeInfoEntries().fileTimestamps;
    return table.missing.includes(file) ? null : table.entries.find(e => e.path === file)?.timestamp;
  };
  const barrier = async value => {
    changed.clear(); removed.clear();
    fs.writeFileSync(witness, value);
    const limit = Date.now() + 6000;
    while (!changed.has(witness) && Date.now() < limit) await sleep(20);
    assert(changed.has(witness), 'same watcher must deliver the witness edit');
    changed.clear(); removed.clear();
  };
  try {
    watcher.watch([[file, witness], []], [[], []], [[], []], BigInt(Date.now()),
      (err, batch) => {
        if (err) errors.push(String(err));
        else {
          for (const p of batch.changedFiles) changed.add(p);
          for (const p of batch.removedFiles) removed.add(p);
        }
      }, () => {});
    // Wait until watches are installed before using the sibling as a queue barrier.
    const limit = Date.now() + 6000;
    while (stamp() !== old * 1000 && Date.now() < limit) await sleep(20);
    assert.equal(stamp(), old * 1000);
    await sleep(200);
    await barrier('ready');
    fs.renameSync(tree, path.join(root, 'away'));
    await barrier('moved out');
    assert(!fs.existsSync(file));
    const afterMove = stamp();
    assert(afterMove === null || afterMove === old * 1000);
    fs.renameSync(next, tree);
    await sleep(1200);
    assert.equal(fs.readFileSync(file, 'utf8'), 'different content');
    const sameMtime = fs.statSync(file).mtimeMs === old * 1000;
    const row = { engine, followSymlinks: mode !== 'no-follow', sameMtime,
      whileAbsent: afterMove === null ? 'missing' : 'old timestamp',
      replacementChanges: relative(changed), replacementRemovals: relative(removed) };
    await barrier('after replacement');
    const dropsRemoval = engine === 'pr' && mode !== 'no-follow';
    assert.equal(sameMtime, mode !== 'new-mtime');
    assert.equal(row.whileAbsent, dropsRemoval ? 'old timestamp' : 'missing');
    assert.deepEqual(row.replacementChanges, dropsRemoval && sameMtime ? [] : ['app/assets/nested/value.js']);
    assert.deepEqual(row.replacementRemovals, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(row));
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

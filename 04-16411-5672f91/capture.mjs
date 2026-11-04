import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(import.meta.url);
const label = process.argv[2];
assert.ok(["pr", "base", "watchpack"].includes(label),
  "Usage: RSPACK_BINDING=/absolute/path/to/binding.node node capture.mjs pr|base; node capture.mjs watchpack");
const binding = label === "watchpack" ? null : process.env.RSPACK_BINDING;
assert.ok(label === "watchpack" || (binding && path.isAbsolute(binding)),
  "Set RSPACK_BINDING to an absolute path to the matching CI-built or locally built .node file");
const implementation = label === "watchpack"
  ? require(process.env.WATCHPACK_PATH || "watchpack")
  : require(binding).NativeWatcher;
const packageJson = label === "watchpack"
  ? require(process.env.WATCHPACK_PATH
    ? path.join(process.env.WATCHPACK_PATH, "package.json")
    : "watchpack/package.json")
  : null;
if (packageJson) assert.equal(packageJson.version, "2.6.3");

async function waitFor(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await sleep(10);
  assert.ok(predicate(), "Timed out waiting for the aggregate");
}

const scenarios = [
  { name: "initial-missing-nested", nested: true },
  { name: "initial-missing-standalone", nested: false },
  { name: "live-removal-nested", nested: true, live: true },
];
const results = [];
for (const scenario of scenarios) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "rspack-16411-"));
  const source = path.join(root, "src");
  const child = path.join(source, "child");
  fs.mkdirSync(source);
  if (scenario.live) fs.mkdirSync(child);
  const past = new Date(Date.now() - 60_000);
  for (const item of [source, ...(scenario.live ? [child] : [])]) {
    fs.utimesSync(item, past, past);
  }
  // Age setup notifications before starting either backend, matching the PR's
  // macOS fixtures. No directory is created/deleted after this in missing cases.
  await sleep(2200);
  const watcher = new implementation({ aggregateTimeout: 50 });
  const events = [];
  const batches = [];
  const relative = file => path.relative(root, file).split(path.sep).join("/");
  const recordBatch = (changed, removed) => batches.push({
    changedFiles: [...changed].map(relative).sort(),
    removedFiles: [...removed].map(relative).sort(),
  });
  const directories = scenario.nested ? [source, child] : [child];
  try {
    const startTime = Date.now();
    if (label === "watchpack") {
      watcher.on("change", (file, mtime) => events.push({
        kind: "change", path: relative(file), mtime: mtime === null ? null : "number",
      }));
      watcher.on("remove", file => events.push({ kind: "remove", path: relative(file) }));
      watcher.on("aggregated", recordBatch);
      watcher.watch({ files: [], directories, missing: [], startTime });
    } else {
      watcher.watch([[], []], [directories, []], [[], []], BigInt(startTime),
        (error, batch) => {
          assert.equal(error, null);
          recordBatch(batch.changedFiles, batch.removedFiles);
        },
        event => events.push({
          kind: event.kind, path: relative(event.path),
          ...(event.kind === "change" ? { mtime: event.mtime === null ? null : "unspecified" } : {}),
        }));
    }
    if (scenario.live) {
      // An existing old-mtime empty context should not generate startup events.
      await sleep(350);
      assert.deepEqual(batches, [], "Live-removal control must start without a startup aggregate");
      assert.deepEqual(events, [], "Live-removal control must start without startup events");
      fs.rmdirSync(child);
    }
    await waitFor(() => batches.length > 0);
    await sleep(250);
    results.push({
      case: scenario.name,
      directories: directories.map(relative),
      childExistedAtWatch: Boolean(scenario.live),
      filesystemMutationAfterWatch: scenario.live ? "rmdir(src/child)" : null,
      events,
      batches,
      changedFiles: [...new Set(batches.flatMap(batch => batch.changedFiles))].sort(),
      removedFiles: [...new Set(batches.flatMap(batch => batch.removedFiles))].sort(),
    });
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const output = {
  label, capturedAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  bindingFile: binding ? path.basename(binding) : null,
  bindingSha256: binding ? createHash("sha256").update(fs.readFileSync(binding)).digest("hex") : null,
  bindingSourceSha: process.env.RSPACK_BINDING_SOURCE_SHA || null,
  version: packageJson?.version || null,
  results,
};
fs.mkdirSync(new URL("results/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`results/${label}.json`, import.meta.url), JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output, null, 2));

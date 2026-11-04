# PR #16411: initial missing nested context loses its removal

Confirmed with Node.js v22.16.0 on macOS arm64 using actual CI-built native
bindings and Watchpack 2.6.3. Register `src` and `src/child` as contexts while
`src` exists and `src/child` does not. The missing child is never created in
this scenario, and no filesystem mutation occurs after `watch()`.

| Implementation | Immediate child event | Aggregate changes | Aggregate removals |
| --- | --- | --- | --- |
| Base `e6ca07e` | `remove(src/child)` | `src` | `src/child` |
| PR CI merge `c343ba8` | **`change(src/child, null)`** | `src` | **empty** |
| Watchpack 2.6.3 | `remove(src/child)` | empty | `src/child` |

The regression is the lost child removal in both the immediate event stream
and `removedFiles`. The base already reports an extra parent change compared
with Watchpack; that existing difference is recorded separately. This case
demonstrates watcher output, not a claim that a particular application produces
an incorrect bundle.

## Check the saved results

No dependencies or native binaries are needed for this command:

```sh
node verify.mjs
```

It checks the captured JSON for all nine implementation/scenario combinations.
This validates saved observations; it does not execute a fresh watcher. The
live harness and commands below reproduce the behavior with real binaries.

## Live reproduction

`capture.mjs` calls the exported `NativeWatcher` directly, avoiding compiler
builds, loaders, and the TypeScript adapter. The core registration is:

```js
// src exists with an old mtime; src/child does not exist.
watcher.watch(
  [[], []],                 // files: added, removed
  [[src, child], []],        // contexts: added, removed
  [[], []],                 // missing dependencies: added, removed
  BigInt(Date.now()),
  (error, batch) => { /* record changedFiles and removedFiles */ },
  event => { /* record kind, concrete path, and nullable mtime */ },
);
```

The equivalent Watchpack registration is
`watchpack.watch({ files: [], directories: [src, child], missing: [], startTime })`.
In both backends the aggregate timeout is 50 ms. Setup notifications age for
2.2 seconds before watching, and directory mtimes are 60 seconds old, so setup
does not look like a newly changed context. The harness records actual events
and batches, including duplicate OS notifications, and normalizes temporary
paths to `src` / `src/child`.

Three scenarios run for each implementation:

1. **Initial missing nested context:** watch `[src, child]` with child absent.
   Only PR loses the child removal.
2. **Initial missing standalone context:** watch `[child]` with child absent.
   All three implementations report its removal. The extra parent registration
   is what triggers the regression.
3. **Live nested-context removal:** child exists at registration, the harness
   checks that there are no startup events, then deletes it. PR and Watchpack
   both report `change(child, null)` with only the parent in aggregate changes.
   This confirms the live-removal behavior that the PR intentionally fixes.

From this directory, use Node.js 22 or newer:

```sh
npm ci

# Saved CI artifacts used for the macOS arm64 comparison.
gh run download 41612412833 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/pr
gh run download 41592405995 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/base

RSPACK_BINDING="$PWD/.bindings/pr/rspack.darwin-arm64.node" \
RSPACK_BINDING_SOURCE_SHA=c343ba8053ec8c387daf7502bb59bbdf7299b974 \
node capture.mjs pr

RSPACK_BINDING="$PWD/.bindings/base/rspack.darwin-arm64.node" \
RSPACK_BINDING_SOURCE_SHA=e6ca07e224a6c9424c8f16b90ed26857c2aac47f \
node capture.mjs base

node capture.mjs watchpack
node verify.mjs
```

`capture.mjs` overwrites only its own `results/<label>.json`; `verify.mjs`
updates `results/verification.json`. A successful verification means the
reported regression and both controls were observed. After a fix, its assertions
about the PR's missing removal should fail.

For another platform, select the corresponding native artifact and `.node`
filename. When artifacts are unavailable, use a matching Rspack checkout at
the source revisions below, install its dependencies, and run
`pnpm run build:binding:dev` before pointing `RSPACK_BINDING` to the built
`crates/node_binding/rspack.<platform>.node` file. No Rspack JavaScript package
build is required because the harness loads the native binding directly.

## Cause

`Scanner::scan()` backfills `Remove(child)` for a newly registered context
absent on disk. `EventProcessor::process()` resolves both the child's removal
and its existing parent's change. The new context-removal conversion in
[`trigger.rs:317–329`](https://github.com/web-infra-dev/rspack/blob/5672f91b41f78c9d3118035838dbfb12b4d7c733/crates/rspack_watcher/src/trigger.rs#L317-L329)
does not distinguish this `Origin::Scan` initial absence from a live deletion.
Since child is registered only as a context, `retain_mut` drops its removal
and suppresses the raw remove callback, emitting `change(child, null)` instead.

Watchpack treats the child's initial missing scan as `initial-missing`, which
[`WatchpackDirectoryWatcher` forwards to `_onRemove`](https://github.com/webpack/watchpack/blob/v2.6.3/lib/index.js#L220-L223).
That differs from removing an already observed child of an existing context,
which is the live case the PR's new tests cover.

## Binding provenance and validation

- Reviewed PR: [#16411](https://github.com/web-infra-dev/rspack/pull/16411),
  head `5672f91b41f78c9d3118035838dbfb12b4d7c733`.
- The **PR binary is built from the CI merge**, not directly from that head:
  `c343ba8053ec8c387daf7502bb59bbdf7299b974`, merging the reviewed head into
  `e6ca07e224a6c9424c8f16b90ed26857c2aac47f`.
  [CI run 41612412833](https://github.com/web-infra-dev/rspack/actions/runs/41612412833),
  artifact `13220350644` (`bindings-aarch64-apple-darwin`). The build job's
  checkout log confirms this merge SHA.
- `crates/rspack_watcher` is identical between the reviewed head and CI merge.
  The merge also includes the base's aggregate callback coalescing change in
  `native_watcher.rs`; that change is present in the base binary too. Comparing
  the CI merge with that exact base keeps this shared change on both sides.
- Base binary: `e6ca07e224a6c9424c8f16b90ed26857c2aac47f`,
  [CI run 41592405995](https://github.com/web-infra-dev/rspack/actions/runs/41592405995),
  artifact `13210991355` (`bindings-aarch64-apple-darwin`).
- Binary SHA-256, source SHA, platform, Node.js version, capture time, raw
  events, and aggregate batches are saved in `results/pr.json` and
  `results/base.json`. `RSPACK_BINDING_SOURCE_SHA` is supplied provenance, not
  a source revision introspected from the binary; the binary hash identifies
  the exact artifact used.
- Watchpack 2.6.3 is pinned in `package-lock.json`, matching the reviewed PR's
  lockfile. Its actual results are in `results/watchpack.json`.
- The PR binary and Watchpack were executed twice successfully on macOS
  arm64. The baseline was checked once at the PR merge base `5eca652c` and
  once at `e6ca07e`; their watcher source is identical. Saved captures use
  `e6ca07e`. No Linux or Windows reproduction is claimed.
- Native binaries and `node_modules` are not committed.

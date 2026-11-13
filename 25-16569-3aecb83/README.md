# PR #16569: overlapping contexts lose a linked file's startup change

With `followSymlinks: true`, register both `app` and `app/link` as directory
dependencies, where `app/link -> target`. Ignore the real `target` path and
its descendants, but allow the link path. A file edited after the build's
`startTime` and before `watch()` is no longer reported through `app`.

Confirmed with actual CI-built native bindings on macOS arm64, Node.js
22.16.0, and Watchpack 2.6.3. There are no filesystem mutations after
`watch()` starts, so this specifically exercises startup backfill.

| Implementation | Both `app` and `app/link` | Only `app` | Only `app/link` |
| --- | --- | --- | --- |
| Base `ab8c28f` | `app`, `app/link` | `app` | `app/link` |
| PR CI merge `201130f` | **no changes** | `app` | no changes |
| Watchpack 2.6.3 | `app` | `app` | no changes |

The base's extra `app/link` notification is an existing filtering difference
that the PR intentionally corrects. The regression reported here is the
loss of the **parent `app` notification**, which both the base and Watchpack
deliver. On the PR, the `app/link/value.js` timestamp is also absent when
both contexts are registered, but present when only `app` is registered.

This can occur when loaders/plugins register overlapping context
dependencies. A parent context's snapshot can miss a file change made
during the build, leaving the build based on old contents until another
event invalidates it. This reproduction observes real watcher notifications
and timestamps; it does not claim to execute a full compiler build.

## Input

```text
fixture/
  app/
    link -> ../target
  target/
    value.js
```

The relevant registration is:

```js
const watcher = new NativeWatcher({
  followSymlinks: true,
  aggregateTimeout: 50,
  ignored: entry => entry === target || entry.startsWith(target + path.sep),
});
// A build reads app/link/value.js at startTime.
// target/value.js changes before watcher registration.
watcher.watch(
  [[], []],                 // files
  [[app, link], []],        // added and removed contexts
  [[], []],                // missing dependencies
  BigInt(startTime),
  recordAggregate,
  recordEvent,
);
```

Watchpack's equivalent uses `watch({ directories: [app, link], startTime })`.
The fixture ages setup notifications for 2.2 seconds. The edit follows the
build start by 50 ms, and the harness checks that the file mtime is newer
than `startTime`. Each watcher runs for 1.2 seconds after registration.

## Run the live comparison

From this case directory, using Node.js 22 or newer:

```sh
npm ci
gh run download 43031862865 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/base
gh run download 43357616600 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/pr

BASE_BINDING="$PWD/.bindings/base/rspack.darwin-arm64.node" \
PR_BINDING="$PWD/.bindings/pr/rspack.darwin-arm64.node" \
node verify.mjs --live
```

This executes nine live watcher scenarios in separate processes for the
three implementations, overwrites `results/{base,pr,watchpack}.json`, and
then verifies the regression and controls. The final message begins `LIVE`.
The verifier is intentionally a bug detector: after a fix, the assertion
expecting no PR notification in the overlapping case should fail.

To inspect the committed observations without downloading binaries or
installing dependencies:

```sh
node verify.mjs
```

This second command only checks saved captures and identifies itself as
`SAVED CAPTURES`; it does not rerun filesystem watching.

For other platforms, use matching native artifacts and adjust the `.node`
filename. Only macOS arm64 was verified here. If artifacts expire, build
the source revisions in `provenance.json` with the repository's
`pnpm run build:binding:dev` command. No JavaScript package build is needed
because the harness loads `NativeWatcher` directly from the native binding.
`--live` labels inputs with the recorded source revisions; provide the
corresponding artifacts, not unrelated binaries.

## Cause and attribution

`LinkSubscriptions::add` records `app/link` in the global
`resolved_directories` map because it is an explicitly registered context.
In [`PathManager::scan_below`, lines 785–788](https://github.com/web-infra-dev/rspack/blob/3aecb83c090e6876ea5849c1e3f9027adabc92a7/crates/rspack_watcher/src/paths.rs#L785-L788),
the resolved-root ignore check then applies to every traversal of that
directory, including traversal reached through the allowed parent `app`.
It skips the child even though a link discovered under a parent context
must use its link path for filtering. `resolved_directory_entry` similarly
selects a globally registered alias without retaining the owning context.

The new tests separately cover explicit and discovered directory links,
but do not combine both registrations for the same link. The two
single-context controls show why dropping the resolved-root ignore check
entirely would not be a complete fix: explicitly watched targets still
need their documented ignore behavior.

The PR's [English documentation](https://github.com/web-infra-dev/rspack/blob/3aecb83c090e6876ea5849c1e3f9027adabc92a7/website/docs/en/config/watch.mdx#L137)
describes the distinction between explicit and discovered directory links.
Watchpack handles explicit links in
[`lib/index.js`](https://github.com/webpack/watchpack/blob/v2.6.3/lib/index.js)
and discovered links in
[`lib/DirectoryWatcher.js`](https://github.com/webpack/watchpack/blob/v2.6.3/lib/DirectoryWatcher.js).

A separate exploratory live-edit comparison also missed the event on the
base native watcher. That existing live-event gap is **not** counted as a
regression introduced by this PR; the published finding is the startup
notification and timestamp regression above.

## Artifact provenance

- Reviewed head: `3aecb83c090e6876ea5849c1e3f9027adabc92a7`.
- PR artifact source: CI merge `201130f1d0578fe01826edc0714060af21cc1bf0`,
  merging the reviewed head into `b14db6b2e07d0f76ea538c2d1c9ca192e77f4bc2`.
  [Build job](https://github.com/web-infra-dev/rspack/actions/runs/43357616600/job/131663841389),
  artifact `14007765143`.
- Control: merge base `ab8c28f6748b19e2b0fee38d5c80ae44483a99ea`.
  [Build job](https://github.com/web-infra-dev/rspack/actions/runs/43031862865/job/130560941414),
  artifact `13860444820`.
- Both source SHAs were checked against the build jobs' checkout logs.
  The watcher crate, native watcher binding adapter, paths, utilities,
  and N-API support are identical between the reviewed head and CI merge,
  and between the control and CI base parent. The only Cargo lockfile
  difference between the base revisions is the unrelated `html-escape`
  update. Exact revisions and comparison paths are in `provenance.json`.
- Captures include binary SHA-256, supplied source provenance, Node.js
  version, platform, raw events, aggregate batches, and timestamps. The
  source SHA is provenance from CI logs, not introspected from the binary.
- Watchpack 2.6.3 matches the PR lockfile and is pinned in
  `package-lock.json`. Native binaries and installed dependencies are not
  committed.

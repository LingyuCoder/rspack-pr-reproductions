# Registering a linked file suppresses its parent context's startup notification

Watch `app` as a directory and `app/link/value.js` as a file, with
`app/link -> ../target`. Enable `followSymlinks` and ignore the physical
`target` directory and its descendants. The file registration should stay
quiet for a target edit. The directory watcher should still report `app`:
it encounters the child as `app/link/value.js`, which is allowed.

The harness reads the file, edits it during the build, then starts watching
with the original `startTime`. **Nothing on disk changes after registration.**
This models a loader that calls both `addContextDependency(app)` and
`addDependency(alias)`. A missing notification can leave the old read in the
build until another change triggers a rebuild.

| Registrations / filter | Base | PR | Watchpack 2.6.3 |
| --- | --- | --- | --- |
| Directory and file / ignore target | `app`, file | **none** | `app` |
| Directory only / ignore target | `app` | `app` | `app` |
| File only / ignore target | file | none | none |
| Directory and file / allow all | `app`, file | `app`, file | `app`, file |

“File” is the registered `app/link/value.js`. The regression is the missing
**directory** notification, not the removal of the base's extra file
notification. On the PR, the directory scan does index the alias. It sees
that the path is a registered file and defers reporting to the file scanner;
[the file scanner skips the ignored target](https://github.com/web-infra-dev/rspack/blob/63b567a5dbd2e3d78d9a1e3e919537d13e2bb8b9/crates/rspack_watcher/src/scanner.rs#L67-L73),
so neither scan delivers a change. See the
[context guard](https://github.com/web-infra-dev/rspack/blob/63b567a5dbd2e3d78d9a1e3e919537d13e2bb8b9/crates/rspack_watcher/src/paths.rs#L903-L909).
The [earlier case](../25-16569-3aecb83/) registered two directories
and no files; that case now passes on this PR.

## Run

From this case directory, on macOS arm64 with Node.js 22 or newer:

```sh
npm ci
gh run download 43469004721 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/base
gh run download 43470470944 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/pr
BASE_BINDING="$PWD/.bindings/base/rspack.darwin-arm64.node" \
PR_BINDING="$PWD/.bindings/pr/rspack.darwin-arm64.node" node verify.mjs --live
```

The live verifier writes [captures](./results/) and checks the regression and
three controls. `node verify.mjs` checks the saved captures only. The verifier
expects the buggy result on the reviewed revision. The reproduction calls the
real native watcher; it does not run a full compiler build.

Reviewed head: [`63b567a`](https://github.com/web-infra-dev/rspack/commit/63b567a5dbd2e3d78d9a1e3e919537d13e2bb8b9).
[PR CI](https://github.com/web-infra-dev/rspack/actions/runs/43470470944/job/132040971159)
built merge `22fce1b`. The [control](https://github.com/web-infra-dev/rspack/actions/runs/43469004721/job/132035634288)
built its first parent, `685744e`. The watcher source and native adapter
match the reviewed head and merge base on their respective sides. See
[provenance.json](./provenance.json) for exact revisions, artifact IDs, and
SHA-256 checksums. Captures identify the platform and Node version.

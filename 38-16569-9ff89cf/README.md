# A different file can have the same symlink timestamp

Watch `app/link.js` with `followSymlinks: true`. Initially the link points to `a.js` containing `A`. Atomically rename a prepared symlink over it so it points to `b.js` containing `B`. The two **target files** have different mtimes. In the failing case, the two **symlinks** have the same old mtime, as can happen when restoring links from timestamp-normalized assets. The fresh-link control performs the same rename without preserving its timestamp.

A read through `app/link.js` now returns `B`, so the native watcher should notify its consumer. The base reports the registered file; the PR emits no change, leaving a consumer displaying the previous file until another event rebuilds it.

| Scenario | Aggregated changes for the registered link |
| --- | --- |
| Base, link mtime preserved | `app/link.js` |
| PR, link mtime preserved | none |
| PR, fresh link mtime | `app/link.js` |
| Watchpack 2.6.3, link mtime preserved | none |

This is a regression from the native watcher; Watchpack shares the limitation. The [mtime comparison](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/symlinks.rs#L85-L98) treats equality as proof that the link is unchanged. The [disk-event filter](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/trigger.rs#L210-L214) then drops even a replacement before checking whether the target changed. The harness confirms both the new contents and the preserved link mtime, and checks delivery of an independent file edit before and after the rename.

## Run the live comparison

On macOS arm64, with Node.js 22+ and GitHub CLI access to Actions artifacts, run from this case directory:

```sh
npm ci
gh run download 44007666669 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/base
gh run download 44009403557 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/pr
node verify.mjs
```

Alternatively, set `BASE_BINDING` and `PR_BINDING` to absolute paths to the two matching native libraries. The verifier creates fresh temporary directories and runs a new Node process for each scenario. It asserts the observed regression. `node verify.mjs --record` also writes [observed.json](./observed.json), including library SHA-256 hashes. No full compiler build is needed.

The [PR build](https://github.com/web-infra-dev/rspack/actions/runs/44009403557/job/133792670102) checked out CI merge `3a37797e1bfcef9a779524272076d040f364b75a` (artifact `14295832675`). Its parents were `c35b8b040c50d6046deaf45f6c34bd2311f00c06` and the [reviewed head](https://github.com/web-infra-dev/rspack/commit/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e), `9ff89cf5cbdc89d8983439ec814ad0151ea1b33e`. The [base build](https://github.com/web-infra-dev/rspack/actions/runs/44007666669/job/133786966474) checked out the merge's first parent (artifact `14294854551`). The watcher source is identical between the CI merge and the PR head, and between the first parent and the PR merge base (`ab8c28f6748b19e2b0fee38d5c80ae44483a99ea`). The separate Watchpack control uses version 2.6.3, pinned by the reviewed head.

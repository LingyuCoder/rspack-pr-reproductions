# Adding an overlapping link context suppresses a live edit on Linux

`app/link` points to the external directory `target`. Watch the directories
`app` and `app/link` with `followSymlinks: true`. The ignore callback
returns true only for `target/value.js`; the same file through the link,
`app/link/value.js`, is allowed. There are **no registered file dependencies**.

Edit `target/value.js` after both contexts have been indexed. The explicitly
registered link is supposed to filter its children by their resolved path, so
it should stay quiet. But the parent context sees a discovered link and should
report `app`. The PR drops the event for both. This can leave a directory-based
loader's output stale while watching.

| Directory registrations / filter | Linux CI base | Linux CI PR | Watchpack 2.6.3 |
| --- | --- | --- | --- |
| `app` and `app/link` / ignore physical file | `app`, `app/link` | **none** | `app` |
| `app` only / same ignore | none | `app` | `app` |
| `app` and `app/link` / allow all | `app`, `app/link` | `app`, `app/link` | `app`, `app/link` |

The base's extra notification for the explicit link is not the regression;
the loss of the parent notification is. All nine runs also edit an ordinary
sibling on the same watcher as a positive control and receive `app`.
The [earlier overlapping-directory case](../25-16569-3aecb83/) changes the file
**before** registration; that startup case passes at this revision.

The [live event filter](https://github.com/web-infra-dev/rspack/blob/63b567a5dbd2e3d78d9a1e3e919537d13e2bb8b9/crates/rspack_watcher/src/trigger.rs#L352-L358)
takes the resolved spelling from the explicitly registered link and returns
before [per-context filtering](https://github.com/web-infra-dev/rspack/blob/63b567a5dbd2e3d78d9a1e3e919537d13e2bb8b9/crates/rspack_watcher/src/trigger.rs#L489-L501)
can preserve the parent. The fixture ignores only a file, so the physical
target directory itself remains subscribed.

## Run

From this directory on Linux x64 with glibc and Node.js 22 or newer:

```sh
npm ci
gh run download 43469004721 -R web-infra-dev/rspack -n bindings-x86_64-unknown-linux-gnu -D .bindings/base
gh run download 43470470944 -R web-infra-dev/rspack -n bindings-x86_64-unknown-linux-gnu -D .bindings/pr
BASE_BINDING="$PWD/.bindings/base/rspack.linux-x64-gnu.node" \
PR_BINDING="$PWD/.bindings/pr/rspack.linux-x64-gnu.node" node verify.mjs --live
```

`--live` runs the actual watchers and writes the [captures](./results/);
`node verify.mjs` checks the saved captures alone. The verifier expects
the erroneous result from the reviewed PR. The recorded comparison uses Node
22.16.0 (Debian x64 userspace under QEMU) and inotify on an ext4 filesystem in
a Linux VM. The test writes to the guest's own filesystem, not a Mac bind
mount. This is a direct watcher test, not a full compiler build.

[PR CI](https://github.com/web-infra-dev/rspack/actions/runs/43470470944/job/132040970795)
built merge `22fce1b` (reviewed head `63b567a`);
the [control](https://github.com/web-infra-dev/rspack/actions/runs/43469004721/job/132035634366)
built its first parent `685744e`. Exact commits, CI artifacts and native
binary SHA-256 checksums are in [provenance.json](./provenance.json).

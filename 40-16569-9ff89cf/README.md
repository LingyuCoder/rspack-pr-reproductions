# Moving an unwatched ancestor leaves a file baseline behind

Register `app/assets/nested/value.js` and `app/witness.js` as files. No directories or symlinks are registered or needed. With `followSymlinks: true`:

1. Rename `app/assets` out of the tree. Write to the witness and wait for its aggregate so the native watcher has processed the preceding event.
2. Read the timestamp table while `value.js` is missing.
3. Move a prepared replacement directory into `app/assets`. Its `value.js` has different contents and the original, aged mtime. Observe the aggregate and read the new contents through the original path.

| Binding / options | File time while absent | Notification for replacement |
| --- | --- | --- |
| Linux base, follow links, original mtime | missing | `app/assets/nested/value.js` |
| Linux PR, follow links, original mtime | **old timestamp** | **none** |
| Linux PR, following disabled, original mtime | missing | `app/assets/nested/value.js` |
| Linux PR, follow links, different mtime | old timestamp | `app/assets/nested/value.js` |

This affects directory swaps such as moving prebuilt assets into place: changed bytes can go unnoticed when deployment or copy tools preserve file timestamps. The [early return](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/trigger.rs#L391-L396) keeps events for an unregistered ancestor with recorded descendants only when it *appeared*. An inotify move-out therefore skips [record removal](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/trigger.rs#L472-L477). When the replacement appears, [descendant recovery](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/trigger.rs#L680-L683) treats that file as unchanged. This is a regression against the native baseline; it is not a claim about Watchpack parity.

## Run

From this directory on Linux x64 (glibc); no npm dependencies are needed:

```sh
gh run download 44007666669 -R web-infra-dev/rspack -n bindings-x86_64-unknown-linux-gnu -D .bindings/base
gh run download 44009403557 -R web-infra-dev/rspack -n bindings-x86_64-unknown-linux-gnu -D .bindings/pr
node verify.mjs
```

The verifier runs real filesystem operations on Linux x64 with Node 22; it does not replay saved output. The [recorded run](./observed.json) used Node 22.16.0 and Linux inotify on a local ext4 filesystem in a Linux VM (Debian x64 userspace via QEMU).

| Build | Source used by GitHub Actions | Linux x64 binding SHA-256 |
| --- | --- | --- |
| [Base CI](https://github.com/web-infra-dev/rspack/actions/runs/44007666669/job/133786966453) | `c35b8b040c50d6046deaf45f6c34bd2311f00c06` | `e4d47aed62196eb42d120915cb12c0d41b8228ee3179326650ee25c1bc041b06` |
| [PR CI](https://github.com/web-infra-dev/rspack/actions/runs/44009403557/job/133792670089) | `3a37797e1bfcef9a779524272076d040f364b75a` | `a84e0f11e9804472b413684cab3ab37dde9637f8fb44fe3889475f7e25ea42b6` |

The PR artifact is the test merge of [the reviewed head](https://github.com/web-infra-dev/rspack/commit/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e) into the exact base above. If the artifacts expire, use Linux bindings built from these commits and set `BASE_BINDING` and `PR_BINDING` to their absolute paths.

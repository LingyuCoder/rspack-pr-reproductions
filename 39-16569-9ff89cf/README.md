# A directory link registered as a file stops reporting changes to its parent context

Watch `app` as a directory with `followSymlinks: true`. Inside it, `app/link` points to the external directory `target`. Without an ignore filter, write to `target/value.js` **after** the watcher has indexed `app/link/value.js` and delivered an ordinary edit. Adding `app/link` to the file dependencies loses both the immediate event and the aggregate notification for `app`; the file's cached timestamp also stops advancing.

This combination can arise during module resolution: Rspack's [file probe](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_resolver/src/cache.rs#L241-L246) records an existing path as a file dependency before returning whether it is a file. A parent directory dependency should continue to observe entries below the link.

| File registrations (always watching directory `app`) | Linux base | Linux PR | Watchpack 2.6.3 |
| --- | --- | --- | --- |
| `app/link` | `app` | **no notification** | `app` |
| None | no notification | `app` | `app` |

Each positive result also reported the immediate path `app/link/value.js`. Ordinary edits to `app/witness.js` were delivered before and after the target write in every configuration. Only the first row regresses from base. The [new file-registration guard](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/paths.rs#L446-L459) skips the discovered directory subscription; the direct file subscription does not route child events to the parent context. This is a watcher-level test.

## Run

From this directory on Linux x64 (glibc):

```sh
npm ci
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

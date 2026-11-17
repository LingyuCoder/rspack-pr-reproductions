# An ignored directory wakes its watched parent

Register `app` as a directory dependency and `app/dist/entry.js` as a missing file. The ignore callback matches `app/dist` exactly; the missing file has its own allowed registration. Leave `followSymlinks` unset. After confirming that a normal edit is reported, create the **empty** `app/dist` directory. There are no symbolic links in the fixture, and the missing file is never created.

The expected change set is empty: the directory creation is ignored, and nothing appeared for the independent missing-file subscription. A loader watching a source tree alongside an optional generated file can otherwise rebuild just because its output directory was created.

| Scenario | Aggregated changes | Immediate paths during directory creation |
| --- | --- | --- |
| Base, default options | none | none |
| PR, default options | `app` | `app/dist` |
| Watchpack 2.6.3, default options | none | none |
| PR, without the missing registration | none | none |
| PR, with `followSymlinks: true` | none | none |

The [recovery guard](https://github.com/web-infra-dev/rspack/blob/9ff89cf5cbdc89d8983439ec814ad0151ea1b33e/crates/rspack_watcher/src/trigger.rs#L391-L397) lets the ignored directory through to look for registered descendants. In the default mode no context filter subsequently removes that directory's own event; it reaches the parent. Descendant recovery can continue without delivering the ignored root. The harness also confirms that an ordinary file edit works both before and after the observation window.

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

# PR #16545: native dynamic imports receive filesystem paths

Reviewed head: `3c7a8bdd7a19d6aa0469583e1e9041d870e5c2bb`.
Merge base: `cde8fcc8fb83fafb4bbe42ba6d0967beb15ec98d`.

The two newly added regression tests call `import(mainUrl)` where `mainUrl` is
actually an absolute filesystem path from `path.join`. On Windows, its drive
letter becomes an unsupported URL scheme, so the native import rejects with
`ERR_UNSUPPORTED_ESM_URL_SCHEME`. A `#` in the checkout/output path also becomes
a URL fragment and causes `ERR_MODULE_NOT_FOUND` on macOS/Linux.

Both `external-reexport-default-live-binding/test.config.mjs:22` and
`external-reexport-multi-entry-split-chunk/test.config.mjs:22` have this pattern.
The Windows job in `.github/workflows/reusable-build-test.yml` runs `test:ci`,
including `EsmOutput.test.mjs` and `RuntimeModeEsmOutput.test.mjs`.

## Live reproduction

Use an isolated checkout of the reviewed revision, with its dependencies and
native/JavaScript artifacts built using the repository development commands:

```sh
git checkout --detach 3c7a8bdd7a19d6aa0469583e1e9041d870e5c2bb
pnpm install
pnpm run build:cli:dev
```

Then run this case from the reproduction repository:

```sh
RSPACK_REPO=/absolute/path/to/rspack node 26-16545-3c7a8bd/verify.mjs
```

Do not globally set `NAPI_RS_NATIVE_LIBRARY_PATH` for this runner: Rstack uses
its own published Rspack build, while the integration cases consume the built
workspace binding from `crates/node_binding`.

The verifier copies the actual head fixture into a temporary case directory
containing `#`, then runs the real repository test entry points. It does not
mock the import, compiler, test hook or test runner. `-u` updates only the
temporary copy's snapshots because its module-path comment changes when copied.
The original case and its snapshots are untouched. Temporary case directories
and generated outputs are removed afterward.

The control adds `pathToFileURL` and changes only the hook's dynamic-import
specifier to `pathToFileURL(mainUrl).href`; its filesystem reads keep using the
original path. The verifier runs both suites again and requires them to pass.
It also calls the unmodified PR hook with a Windows drive-letter output path
and requires the native loader's protocol error before filesystem lookup.

## Observed comparison

| Input | Result |
| --- | --- |
| Original hook, output path containing `#` | Both real test files fail with `ERR_MODULE_NOT_FOUND` |
| Same input, `pathToFileURL(mainUrl).href` control | Both test files and both cases pass |
| Unmodified hook, `C:\rspack\dist` output path | `ERR_UNSUPPORTED_ESM_URL_SCHEME`, protocol `c:` |

Verified on macOS arm64 with Node.js v22.16.0 and pnpm 11.28.11. The real suites
ran on macOS; the drive-letter probe is not a complete Windows CI run. This is
a defect in tests introduced by this PR, not a new bundler-output regression.
These test files do not exist at the merge base, so the comparison is the
actual head hook versus a one-expression file-URL control.

`fixture/` contains the original head input and hook. `results/` contains the
captured runs and actual generated bundles. `verify.mjs` always rebuilds and
executes the suites; it never treats those saved logs as proof of a new run.

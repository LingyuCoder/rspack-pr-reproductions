# An intermediate module bypasses the prior-chunk ordering guard

The original direct re-export reproduction now passes, but adding a side-effectful `bridge.mjs` between the entry and the external still fails. The entry imports `setup.mjs` (extracted by splitChunks), re-exports through the bridge, then imports a side-effect-free external. The external checks a flag initialized by setup. The module-by-module scan sees the bridge dependency before the entry dependency on setup, so the external is not recorded in `blocked_by_prior_chunk`. Retaining its raw import emits it before the setup chunk. Source and current base return 42; the reviewed head throws before setup executes.

## Verify

Run `node verify.mjs` in this directory with Node.js 22 or newer. No install is needed: it imports the original source and the actual generated base/PR bundles in separate Node processes.

```text
source: 42
base: 42
pr: Error: setup must run first
```

Input is in `src/`, exact production configuration in `build.mjs`, and actual generated bundles plus external fixtures in `dist/base/` and `dist/pr/`. `comparison.txt` captures the live verification result. `provenance.json` records source SHAs and binding hashes.

## Build provenance and regeneration

- Reviewed PR head: [`227188f`](https://github.com/web-infra-dev/rspack/commit/227188f25f6f9af948d2a703fb93344c77dd077d), built locally with `pnpm run build:binding:dev`.
- Current base: [`25976e8`](https://github.com/web-infra-dev/rspack/commit/25976e8d5ae073375ebbf43ab0acca7eb0f82b5f), macOS arm64 binding from [run 42860907089](https://github.com/web-infra-dev/rspack/actions/runs/42860907089/artifacts/13786526858).
- Both use Rspack 2.3.2 with the JS wrapper built at the PR head using `pnpm run build:js` (unchanged relative to base).
- Verified with Node.js v24.22.0 on macOS arm64.

Use absolute paths to the built wrapper and corresponding native bindings:

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/base/rspack.darwin-arm64.node node build.mjs base
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/pr/rspack.darwin-arm64.node node build.mjs pr
node verify.mjs
```

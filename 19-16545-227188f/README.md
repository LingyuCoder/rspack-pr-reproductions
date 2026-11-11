# Unicode local re-export still produces invalid ESM

The earlier non-identifier export fix passes for `"x-y"`, but `is_valid_prop_ident` accepts `é` and keeps it as the local binding. The ESM renderer then calls `export_name` on that local name; its ASCII-only test quotes it. The output contains `import { é } from "./ext.mjs"` followed by `export { "é" as value }`, which is invalid without a `from` clause. Source and current base return 42; the reviewed head throws a SyntaxError. The same result occurs with `你好`. This remains a PR-introduced regression relative to its current base.

## Verify

Run `node verify.mjs` in this directory with Node.js 22 or newer. No install is needed: it imports the original source and the actual generated base/PR bundles in separate Node processes.

```text
source: 42
base: 42
pr: SyntaxError: String literal module export names must be followed by a 'from' clause
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

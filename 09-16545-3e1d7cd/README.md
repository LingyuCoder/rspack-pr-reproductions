# A retained external moves ahead of its prerequisite split chunk

The entry first imports a local setup module (extracted via `splitChunks`), then re-exports `value` from an external module, then imports a side-effect-free external. The setup sets a global flag; the first external checks that flag at top level. Source and base load successfully. The PR emits the retained raw import before the split-chunk imports, so loading the library throws before the setup can run.

Run `node verify.mjs` in this directory (no install). It imports the original input and each actual generated bundle in a fresh Node process. On Node.js v24.22.0, macOS arm64:

```text
source: 42
base: 42
pr: Error: setup must run first
```

Sources are in `src/`, production configuration in `build.mjs`, generated modules and external fixtures in `dist/base/` and `dist/pr/`.

- Base: merge base [`d999646`](https://github.com/web-infra-dev/rspack/commit/d99964616667011de08dd5ac77c86395ccfdde1a), macOS arm64 binding from [CI run 42584786151](https://github.com/web-infra-dev/rspack/actions/runs/42584786151/artifacts/13658514380).
- PR: exact head [`3e1d7cd`](https://github.com/web-infra-dev/rspack/commit/3e1d7cd0cde668971934a5ac7e9fb20fc49bf8ad), built using `pnpm run build:binding:dev`.
- Both builds use the same JS wrapper (Rspack 2.3.1, built on the reviewed head with `pnpm run build:js`; unchanged relative to the merge base).

To regenerate, use the built wrapper and absolute paths to the native bindings for the corresponding revisions:

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/base/rspack.darwin-arm64.node node build.mjs base
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/pr/rspack.darwin-arm64.node node build.mjs pr
node verify.mjs
```

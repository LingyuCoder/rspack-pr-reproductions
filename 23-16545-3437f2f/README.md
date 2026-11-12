# Retaining an external import breaks a default re-export's live binding

With `output.library.type: 'modern-module'`, this entry must keep the default
export connected to the external module's mutable `value` binding:

```js
export { value as default, update } from './ext.mjs';
import './side.mjs';
```

The external starts with `export let value = 1`; its `update()` function assigns
`value = 2`. A consumer reads the library's default export before and after calling
`update()`. Native ESM and the PR's exact merge base observe `1 -> 2`.

On the reviewed head, the later side-effect import causes the external import to
be retained. The default export then reaches the existing local-export renderer,
which emits `export default value;`. That expression takes a snapshot, so the
consumer observes `1 -> 1`. The base instead emits the live re-export
`export { update, value as default } from './ext.mjs';`.

The changed path is `crates/rspack_plugin_esm_library/src/link.rs:3055-3056`, where
retaining the import skips the rewrite into a re-export. Keeping the import should
also preserve live-export syntax, such as `export { value as default };`.
The added PR tests use named constant exports and do not cover a mutable binding
re-exported as the default export.

## Verify

Run with Node.js 22.12 or newer, without installing dependencies:

```sh
node verify.mjs
```

The verifier imports the original source and the actual generated bundles in
separate Node processes, calls the external update function, and checks the
observed values. It succeeds when the regression is reproduced:

```text
source: default 1 -> 2
base: default 1 -> 2
pr: default 1 -> 1
```

`src/` contains the input, `build.mjs` contains the production configuration,
`dist/base/` and `dist/pr/` contain the actual generated bundles and external
fixtures, and `comparison.txt` captures the live verification output.

## Build provenance and regeneration

- Reviewed head: [`3437f2f`](https://github.com/web-infra-dev/rspack/commit/3437f2ff751cd2b4cd7c6314b766745acfc11258).
- Exact merge base: [`cde8fcc`](https://github.com/web-infra-dev/rspack/commit/cde8fcc8fb83fafb4bbe42ba6d0967beb15ec98d).
- Both native bindings were built locally from clean source using
  `pnpm run build:binding:dev`, with Rust `nightly-2026-04-16`.
- Both runs used the same Rspack 2.3.2 JS wrapper previously built with
  `pnpm run build:js` at `227188f25f6f9af948d2a703fb93344c77dd077d`.
  Its package and binding-wrapper sources are unchanged at both compared revisions.
- Verified on macOS arm64 with Node.js v22.16.0. Exact binding and wrapper hashes
  are recorded in `provenance.json`.

To rebuild the bundles with the corresponding built bindings and JS wrapper:

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/base/rspack.darwin-arm64.node node build.mjs base
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/pr/rspack.darwin-arm64.node node build.mjs pr
node verify.mjs
```

Use the equivalent native binding filename on other platforms. No native binary
or dependency installation is needed to execute the saved generated bundles.

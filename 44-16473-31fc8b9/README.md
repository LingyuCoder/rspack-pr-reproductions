# Deleting original compressed assets breaks shared fallback compilation

PR [#16473](https://github.com/web-infra-dev/rspack/pull/16473) moves
`getShareContainerFile` from process-assets stage 0 to
`PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER` (3000). The independent compiler inherits
the parent's plugins before applying `SharedContainerPlugin`. An inherited
`compression-webpack-plugin` therefore runs first at the same stage.

With `deleteOriginalAssets: true`, compression removes `share-entry.js` from both
the assets and `chunk.files` and emits `share-entry.js.gz`. The newly delayed
filename collector then sees no files and throws
`no files found for shared compat-shared chunk`, failing the whole parent build.
This also affects the default un-hashed fallback filename.

Serving only precompressed files is a supported compression deployment mode: a
server can serve `share-entry.js.gz` with the appropriate content encoding for a
request to `share-entry.js`. A missing uncompressed disk file should not become a
compilation error. The base emits a valid gzip containing the shared module.

The live input uses the public `sharing.SharePlugin` and
`sharing.TreeShakingSharedPlugin`, a real npm `compression-webpack-plugin`, and a
generated local package. No hook, compiler, compression operation, or chunk list
is mocked. The same independent-compiler plugin inheritance is used by the
built-in `container.ModuleFederationPlugin` when shared tree shaking is enabled.

| Input | Expected | Observed |
| --- | --- | --- |
| Base, delete originals | Successful gzip-only build | Success; callback runs; gzip contains the module |
| PR head, delete originals | Same successful build | Build error; callback never runs |
| PR head, keep originals | Successful build | Success; JS and gzip both exist |
| PR head, collector at stage 2501 | Successful gzip-only build | Success; callback runs; gzip contains the module |

The last row changes only the collector's stage to
`PROCESS_ASSETS_STAGE_OPTIMIZE_HASH + 1`, after content hash optimization and
before compression. It is an optional diagnostic control, included in the
recorded comparison as `head-stage-2501-control`.

## Revisions and artifacts

- Base / merge base: `cfa30dbf41e68c5f192901da0cc967de7ee6c850`.
- Reviewed head: `31fc8b98224fb701924424f53f9ea1af87d44e8e`.
- Both JavaScript wrappers were rebuilt from those exact source revisions with
  the package's `build` script (`rs lib`).
- All live comparisons use the same native binding from
  [base CI run 42188308253](https://github.com/web-infra-dev/rspack/actions/runs/42188308253),
  artifact `bindings-aarch64-apple-darwin` (ID `13489181824`). The PR changes no
  native sources, Cargo configuration, or binding interfaces; this exact base
  native artifact is also applicable to its head.
- Verified on macOS arm64, Node.js 22.16.0, with
  `compression-webpack-plugin@12.0.0`; dependency versions are pinned in the lockfile.

`provenance.json` records wrapper and binary SHA-256 hashes and source revisions.
`observed.json` contains the live comparison captured during review.

## Run live

Build the JavaScript packages in clean Rspack checkouts of the base and head using
the repository's development commands (`pnpm install --frozen-lockfile`, then
`pnpm run build:js`). Download the native binding from the base run:

```sh
gh run download 42188308253 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir /absolute/path/to/base-binding

export BASE_CORE=/absolute/path/to/base/packages/rspack/dist/index.js
export HEAD_CORE=/absolute/path/to/head/packages/rspack/dist/index.js
export BINDING=/absolute/path/to/base-binding/rspack.darwin-arm64.node

npm ci --ignore-scripts
node verify.mjs
```

Other platforms need the corresponding native artifact from that run, or a
native build from the exact base source. Do not substitute a published release
binding merely because its package version also reads `2.3.1`: that release does
not have all of the binding interfaces used by these source revisions.

The verifier always rebuilds the application against both provided wrappers and
checks that the emitted gzip really decompresses to the shared implementation.
It does not replay the saved capture. Add `--record` to refresh that capture.

To repeat the optional stage control, apply `stage-control.patch` to a third head
checkout, rebuild its JavaScript package, and set `FIXED_CORE` to its built
`packages/rspack/dist/index.js` before running the same verifier.

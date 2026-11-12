# A local CSS watch edit rebuilds all producers of an unchanged shared stylesheet

The input has 100 root stylesheets, each importing the same `shared.css`. After an initial build, the reproduction changes only `root0.css` and passes that modified filename through Rspack's real incremental rebuild path. It repeats the edit three times (blue, red, blue). The plugin only counts `buildModule` notifications; it never calls `rebuildModule`.

| Per edit | Merge-base | PR head |
| --- | ---: | ---: |
| `buildModule` calls | 3 | 202 |
| Distinct root stylesheets rebuilt | 1 | 100 |
| Output color | Correct | Correct |

`cutout` now invokes `expand_rebuild_modules` for ordinary file changes too. The expansion follows `root0 -> shared.css` and adds every incoming producer of that generated CSS module, even though the shared stylesheet and 99 roots are unchanged. This turns a local watch update into reconstruction of the entire shared group. Each included producer also rescans the same incoming set, adding quadratic traversal work.

Anchor: `crates/rspack_core/src/compilation/build_module_graph/graph_updater/cutout/mod.rs:83`; reverse expansion is in `graph_updater/mod.rs:29-33`.

The verifier compares actual module build counts and output correctness, not timing. Native build profiles differ in the recorded comparison, so it makes no walltime claim. The existing shared-CSS regression deliberately changes global loader state; that scenario does not test the locality of an ordinary single-file edit.

## Live verification

Use Node.js 24 and build the JavaScript wrapper and native binding for each revision. Set these absolute paths:

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/rspack.darwin-arm64.node
```

The verified revisions are PR head `30ca66e8cccd15b7c145f0da6994ace75010448b` and merge-base `66478d2824205bc8c90768dd68feb7f85fb03c2c`. `provenance.json` records the exact native sources and hashes. The head native source is unchanged by the final benchmark/snapshot-only commit. The base uses the matching macOS arm64 CI artifact and a wrapper built from the base source.

`verify.mjs` runs the live cases in separate processes; it does not replay the captured output. `comparison.json` contains the verification recorded during review. Set `RECORD=1` to update that capture after a live run.

Install this case's pinned `css-loader` dependency, or set `CSS_LOADER` to an already installed absolute `css-loader/dist/cjs.js` path:

```sh
npm install --ignore-scripts
node verify.mjs
```

To run a single revision with another group size:

```sh
RSPACK_CORE="$HEAD_CORE" NAPI_RS_NATIVE_LIBRARY_PATH="$HEAD_BINDING" node repro.mjs 100
```

The generated input and build output use a fresh temporary directory. Passing `separate` as the second argument removes the shared import as an additional control.

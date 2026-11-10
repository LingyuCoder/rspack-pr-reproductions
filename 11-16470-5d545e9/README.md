# Source-map emission retains the minifier's input chunk

This builds a normal production bundle with the default JS minimizer, external source maps and `cache: false`. A generated comment makes the original chunk much larger than the minified JS; no custom loader or source implementation is involved. The external map intentionally includes the original module on both revisions.

The SWC minimizer also puts a *separate*, pre-minification copy of the generated **chunk** into the intermediate source map. The observed buffer contains 8,400,042 bytes; the minified JS is 20 bytes before the source-map URL is appended. The question is whether the compilation still owns that intermediate chunk after emitting and composing the final source map.

`probe.py` adds the same observer to the minimizer in each checkout. It holds a **weak** reference to the actual minimized source and one reference to the largest intermediate source-content buffer. At `afterEmit`, `Bytes::is_unique()` establishes whether that observer is the **only** remaining owner of that buffer. This distinguishes extra retained bytes from source content already needed by a module or the final map. No RSS or timing assumption is needed.

- Base: PR merge base [580d3467e8](https://github.com/web-infra-dev/rspack/commit/580d3467e8e63a2860e7b6db4f657dbb8137a927).
- PR: exact head [5d545e903e](https://github.com/web-infra-dev/rspack/commit/5d545e903e7fc801de95d48129ddcb102d50c93e).
- At current main [d30a883abf](https://github.com/web-infra-dev/rspack/commit/d30a883abf352d9bad4ee3809cce42eb049589b7), the minimizer still constructs the same intermediate source, and DevTool still flattens it on this path. This is a code comparison; the instrumented baseline measurement is from the PR merge base.
- macOS arm64, Node 24.20.0. Same JS core on both sides. `fixture.cjs` checks that JS is minified and that the external map contains the original source.

Check the recorded comparison:

```sh
node verify.mjs
```

To reproduce from source, use separate Rspack checkouts at the above revisions. Run `python3 /path/to/this/case/probe.py "$PWD"` once in each clean checkout, then build its dev binding (`pnpm run build:binding:dev`; install its dependencies first). Point both runs at the same built JS core. Using the platform-appropriate binding filenames:

```sh
export RSPACK_CORE=/path/to/head/packages/rspack/dist/index.js
node verify.mjs /path/to/base/crates/node_binding/rspack.darwin-arm64.node \
                /path/to/head/crates/node_binding/rspack.darwin-arm64.node
```

The scope is post-emit asset retention while the compilation is alive; this case does not measure overall peak RSS or claim that memory stays allocated after the compiler is destroyed.

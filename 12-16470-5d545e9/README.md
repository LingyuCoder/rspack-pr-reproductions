# Hashing one asset with several SRI algorithms loses parallelism

The input is the published TypeScript 6.0.3 compiler (9,144,216 bytes; SHA-256
`569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39`).
One entry imports it as an `asset/source` resource. Rspack builds a normal
single-chunk bundle: **no instrumentation plugin replaces or injects an output
asset**. Source maps, minification and RealContentHash are disabled to isolate
the SRI change. Both variants verify the digest against Node's crypto library
using the bytes actually emitted.

Before the PR, the initial SRI pass on ordinary chunk sources computed the
selected algorithms in parallel. In the PR it writes to one digest writer,
which updates SHA-256, SHA-384 and SHA-512 sequentially. This matters with
multiple algorithms and few large chunks; the default single SHA-384 does
not have the same lost parallelism.

## Reproduce

Use Node 24 (tested with 24.20.0), npm, and a multi-core machine. Set
`RSPACK_CORE` to the absolute `packages/rspack/dist/index.js` of the reviewed
checkout after building the JS wrapper (`pnpm install --frozen-lockfile` and
`pnpm run build:js`). Set it for **both** arms so that only the native binding
changes. Alternatively a matching installed `@rspack/core` is supported.

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
node verify.mjs
```

On Darwin arm64 the verifier downloads the two native bindings from the CI
runs below using an authenticated `gh` client. It fetches the TypeScript
input with `npm pack typescript@6.0.3` and verifies its SHA-256. To run
offline or use matching release builds on another architecture, set
`RSPACK_MAIN_BINDING`, `RSPACK_PR_BINDING` and `TYPESCRIPT_JS` to absolute
paths. Do not compare a debug binding against a release binding.

## Measurement

Each process performs seven complete builds, discarding the first; the order
is main, PR, PR, main (12 measured builds per side). The verifier sets
`RAYON_NUM_THREADS=8`. Taps at processAssets stages 698 and 700 measure the
SRI plugin at stage 699. The total also includes compiler creation,
compilation, emission and close (the output filesystem is warm); it excludes
loading the input, process startup and the independent digest assertion.
The main assertion compares stage medians, not total times, which are
sensitive to unrelated work and caches.

See [observed.txt](observed.txt) for the actual run on an Apple M5 Max
(18 logical cores), macOS arm64. With three algorithms the SRI stage
increased from 22.30 ms to 46.74 ms, whereas the SHA-384 control was
14.87 ms and 14.51 ms. The whole multi-algorithm build took 44.82 ms and
73.03 ms respectively. This is a controlled one-entry workload; projects
with many assets, other bottlenecks or fewer available cores need not show
the same end-to-end slowdown.

- Main: [d30a883](https://github.com/web-infra-dev/rspack/commit/d30a883abf352d9bad4ee3809cce42eb049589b7), [release artifact](https://github.com/web-infra-dev/rspack/actions/runs/42769589391/artifacts/13741457138).
- PR: [CI merge d38c877](https://github.com/web-infra-dev/rspack/commit/d38c87743dd6c64006734acde2f3f4b409f97af5), parents main d30a883 and reviewed [head 5d545e9](https://github.com/web-infra-dev/rspack/commit/5d545e903e7fc801de95d48129ddcb102d50c93e), [release artifact](https://github.com/web-infra-dev/rspack/actions/runs/42772939683/artifacts/13742927281).

# Edited external source maps are slower to emit

An external map has a `file` field containing its chunk filename. With production `realContentHash` and `output.filename: "[name].[contenthash:8].js"`, substituting the final content hash can change this field. The bundled compiler calls the resulting asset's `Source::buffer()` at emit. On main this encodes the JSON with the SIMD serializer and substitutes the edit while writing; PR #16470 creates a `ReplaceSource`, whose byte materialization visits escaped JSON rope fragments one at a time.

## Reproduce

From this directory, run `node verify.mjs` with Node, Cargo/rustup, git, tar and curl available. Optionally set `RSPACK_REPO=/path/to/rspack` to reuse a Git clone containing all three commits. The verifier checks the input tarball and member SHA-256, builds the real `rspack_sources` crate with the pinned Rust toolchain at each SHA in release mode, and runs each binary. Temporary files are deleted at exit. Dependencies must be accessible through Cargo's configured registries; run on a quiet machine for timing comparisons.

Input: [colorjs.io@0.5.2 tarball](https://registry.npmjs.org/colorjs.io/-/colorjs.io-0.5.2.tgz), member `package/dist/color.legacy.js.map`. The fixture sets `file` to `main.deadbeef.js` and makes the same single 8-byte replacement as RCH. Every binary independently checks the entire emitted buffer against the original serialized JSON with just that hash replaced. Input parsing and replacement setup are outside the timed loop. The unedited asset is timed as a control; each sample measures 50 `buffer()` calls, with 11 samples per binary invocation and alternating revisions. The verifier checks for a >10% slowdown in the edited case on the running machine (frequency scaling, architecture, allocator and toolchain can affect this).

## Observed

On Darwin arm64, the 471,977-byte edited map took 322–341 µs on current main (`d30a883abf`), 352 µs at the merge base (`580d3467e8`) and 421–440 µs on the reviewed head (`5d545e903e`), using medians per invocation. Head/main = 1.30 and head/merge-base = 1.22 in this run. These timings isolate **materializing the edited map**; they are not a claim that the whole build takes 30% longer. A separate ordinary production build confirmed the map's `file` actually changed across the RCH stage (2499 vs 2501); the observed values and complete timing samples are in [comparison.json](./comparison.json).

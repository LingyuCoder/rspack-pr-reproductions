# Inline source maps keep a redundant Rust owner of the unencoded original content

A plugin emits a prebuilt JS asset and supplies its source map through the supported `compilation.emitAsset(..., new SourceMapSource(...))` API. The asset is not marked as minimized. With ordinary `inline-source-map`, both revisions emit exactly the same JS and base64 map and include its complete original source. The PR additionally leaves the input `SourceMapSource` reachable from the emitted asset after emission. The fixture uses 8,450,020 original bytes to make the extra retained ownership measurable; the result measures live source bytes, not peak process RSS.

Use clean checkouts of merge base `580d3467e8e63a2860e7b6db4f657dbb8137a927` and PR head `c6ec478e89492da3a7fba80a36481b4c1f724096`. Apply `python3 probe.py /path/to/checkout` to each, then build their normal development native bindings. The observer puts a transparent AsRef<[u8]> owner with a Drop marker around the same input Vec passed to Bytes::from_owner during map parsing. The map's largest source content selects the backing allocation by its address. After emitting JS, it reports that actual allocation's Drop state and the original source's weak strong count. The observer holds neither a source nor a byte reference at that point. It does not modify the source graph, map serialization or emitted bytes.

With a compatible built JS package (e.g. the PR checkout's `packages/rspack/dist/index.js`), run:

```sh
RSPACK_CORE=/absolute/path/to/packages/rspack/dist/index.js node verify.mjs /absolute/path/to/base.node /absolute/path/to/head.node
```

`node verify.mjs` checks the captured result in `comparison.json`. This uses neither `nosources` nor a minifier; it is independent of the production minifier regression in case 11.

The same trigger can be checked on a real prebuilt JS asset, the unmodified `colorjs.io@0.5.2/dist/color.legacy.js` and matching 472,264-byte map. Its 172 `sourcesContent` entries contain 209,202 bytes in total. The observer measures the largest single original (9,643 bytes). To rerun from the case directory with the same instrumented bindings:

```sh
mkdir -p /tmp/colorjs-inline-map-repro
npm pack colorjs.io@0.5.2 --pack-destination /tmp/colorjs-inline-map-repro
tar -xzf /tmp/colorjs-inline-map-repro/colorjs.io-0.5.2.tgz -C /tmp/colorjs-inline-map-repro
VENDOR_JS=/tmp/colorjs-inline-map-repro/package/dist/color.legacy.js RSPACK_CORE=/absolute/path/to/packages/rspack/dist/index.js node verify.mjs /absolute/path/to/base.node /absolute/path/to/head.node
```

Both revisions emit byte-identical JS with a full inline map. In the PR, the pre-DevTool source and its original map remain reachable; on the merge base the input source is dead, and the input JSON allocation containing the sampled original is dropped. See `colorjs-comparison.json`.

On Darwin arm64 with Node 24.20.0, the 8,450,109-byte backing allocation in the stress case and the 472,264-byte backing allocation for the packaged library were both dropped by afterEmit on the merge base and both still alive on the PR head. SHA-256 of emitted JS with inline map matched for each comparison. The instrumentation reports actual destruction of the backing Vec, rather than inferring it from source wrapper reference counts.

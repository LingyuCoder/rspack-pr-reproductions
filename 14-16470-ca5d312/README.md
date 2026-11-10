# External no-sources maps retain the input map through the emitted JavaScript

A plugin emitting a prebuilt vendor asset supplies its map using `compilation.emitAsset(name, new rspack.sources.SourceMapSource(...))`. The fixture uses `nosources-source-map`, a cold compilation, no cache, and no minimization. The external map contains locations and no `sourcesContent`. Its JS and map have identical SHA-256 digests across revisions.

At `afterEmit`, the Rust source object that entered DevTool has **zero** strong references on the merge base and **one** on the PR. A Drop marker on the actual parsed map's backing allocation changes from **dropped** to **alive**. The rendered code wraps the input source because the current text-only branch handles inline maps and minimized assets but not external maps that discard source content. The external map does not need this allocation: clearing sourcesContent already detaches its remaining metadata in both versions. Retention lasts while the emitted source is held, with a cost proportional to the input maps. This measures a live allocation, not a change in whole-process peak RSS.

| Input | Input map allocation | Merge base | PR head |
| --- | ---: | --- | --- |
| Generated map with a large source comment | 8,450,109 bytes | dropped | alive |
| Published colorjs.io 0.5.2, dist/color.legacy.js.map | 472,264 bytes | dropped | alive |

## Reproduce

1. Use clean checkouts of merge base `580d3467e8e63a2860e7b6db4f657dbb8137a927` and head `ca5d3122ab09991916b7bb2d8a7f52523b4ce331`. Run `python3 probe.py /path/to/checkout` on each, then build each checkout's development native binding. Build a compatible JS wrapper using the project's normal JS build. The observer from case 13 holds only a weak Source reference and a path to the marker; it does not keep the map or bytes alive. In this verification the head binary also carried an inactive inline-cache-restore observation; the cache was disabled.
2. With Node 24 (tested 24.20.0 on macOS arm64), run from this directory:

```sh
export RSPACK_CORE=/absolute/path/to/packages/rspack/dist/index.js
node verify.mjs /absolute/path/to/base.node /absolute/path/to/head.node
```

3. Optionally run the same comparison using the published library:

```sh
mkdir -p /tmp/colorjs-nosources-repro
npm pack colorjs.io@0.5.2 --pack-destination /tmp/colorjs-nosources-repro
tar -xzf /tmp/colorjs-nosources-repro/colorjs.io-0.5.2.tgz -C /tmp/colorjs-nosources-repro
VENDOR_JS=/tmp/colorjs-nosources-repro/package/dist/color.legacy.js node verify.mjs /absolute/path/to/base.node /absolute/path/to/head.node
```

The verifier checks the allocation's lifetime, the input's remaining references and both output digests. With no arguments, `node verify.mjs` checks the recorded stress case and `VENDOR_JS=recorded node verify.mjs` checks the recorded vendor case.

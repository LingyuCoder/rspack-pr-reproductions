# A namespace default rejects methods inherited by the exported value

[namespace.mjs](./fixtures/namespace.mjs) re-exports a JSON array and a CommonJS object as namespaces. The consumers call methods on their default values. `map` belongs to `Array.prototype`, and `hasOwnProperty` belongs to `Object.prototype`; neither is a named export.

| Consumer (production) | Native Node | Base | PR |
| --- | --- | --- | --- |
| Direct JSON default import: `items.map(…)` | `AB` | `AB` | `AB` |
| [JSON namespace](./fixtures/array.mjs): `items.default.map(…)` | `AB` | `AB` | Linking error: `map` not found (possible exports: `0, 1`); no bundle |
| [CommonJS namespace](./fixtures/object.mjs): `ns.default.hasOwnProperty("data")` | `true` | `true` | Linking error: `hasOwnProperty` not found (possible exports: `data`); no bundle |

The [presence lookup](https://github.com/web-infra-dev/rspack/blob/721350d84f664a5c57b79799495f101d6195906f/crates/rspack_core/src/exports/exports_info_getter.rs#L191-L197) strips `default` and checks the remaining name against the module's own exports. That information can identify own exported keys, but cannot rule out a property inherited by the runtime value.

## Run the comparison

From this directory, using Node.js 22.16 or later on macOS arm64:

```sh
npm ci --ignore-scripts
gh run download 43805778859 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/base
gh run download 43819526388 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/pr
node verify.mjs
```

The verifier runs the original ESM entries in Node, builds each entry in a fresh output directory with each native binding, and executes the emitted bundles. It checks the diagnostics and stdout against the recorded regression. Use `node verify.mjs --record` to rewrite [observed.json](./observed.json) and [bundles/](./bundles/). To use other matching artifacts or local builds, point `BASE_BINDING` and `PR_BINDING` at their absolute `.node` paths.

Both runs used the published `@rspack/core@2.3.2` JavaScript wrapper, Node.js 22.16.0, and the following CI builds. The PR only changes Rust and test fixtures.

| | Compiled source | macOS arm64 binding SHA-256 |
| --- | --- | --- |
| [Base build](https://github.com/web-infra-dev/rspack/actions/runs/43805778859/job/133096241083) | [`8f8065fbf7f968f8ffe5ddc1fde5c44b68f55f8a`](https://github.com/web-infra-dev/rspack/commit/8f8065fbf7f968f8ffe5ddc1fde5c44b68f55f8a) | `50ddaab917a1bdf22d87bfd53d660e070754e9b4f1b00ea50b9231857ce1d59c` |
| [PR build](https://github.com/web-infra-dev/rspack/actions/runs/43819526388/job/133151943323) | [`a79dab322fba5c8de08614e6db6120abfe8c1866`](https://github.com/web-infra-dev/rspack/commit/a79dab322fba5c8de08614e6db6120abfe8c1866) | `183c7f3e73540af34ab6d4ff705946d224bab1d88096db8e8775e1f62968e927` |

The PR build checked out GitHub's test merge. Its parents are the base above and [reviewed head `721350d84f664a5c57b79799495f101d6195906f`](https://github.com/web-infra-dev/rspack/commit/721350d84f664a5c57b79799495f101d6195906f).

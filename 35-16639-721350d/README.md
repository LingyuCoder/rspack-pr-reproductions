# A barrel loses the default property of a CommonJS namespace

[lib.cjs](./fixtures/lib.cjs) exports `data` and has no property named `default`. [namespace.mjs](./fixtures/namespace.mjs) re-exports it as `ns`. In [barrel.mjs](./fixtures/barrel.mjs), `export { ns }` forwards the same namespace, so its `default` property should still be the CommonJS exports object.

| Consumer | Native Node | Base | PR |
| --- | --- | --- | --- |
| `ns.default.data`, direct (production) | `ok` | `ok` | `ok` |
| `ns.default.data`, through the barrel (production) | `ok` | `ok` | Linking error: `'ns'.'default'` was not found; no bundle |
| `"default" in ns`, through the barrel (development) | `true` | `true` | `false`, with no diagnostic |

The PR [sets the marker on the namespace re-export](https://github.com/web-infra-dev/rspack/blob/721350d84f664a5c57b79799495f101d6195906f/crates/rspack_plugin_javascript/src/dependency/esm/esm_export_imported_specifier_dependency.rs#L1367), but the forwarded export only recovers the nested exports table. That table correctly omits a real CommonJS property named `default`; it cannot tell the consumer that the namespace itself supplies one. Compare the emitted [base](./bundles/base-presence.cjs) and [PR](./bundles/pr-presence.cjs) presence checks: the boolean is fixed at build time.

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

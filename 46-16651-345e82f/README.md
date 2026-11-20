# A descendant external runs before an earlier initializer

The entry imports external `setup.mjs` before bundled `local.mjs`. The latter
imports external `consumer.mjs`, which requires the initialization from setup.
There are no repeated requests, shared chunks, re-exports, or conflicting order
constraints. The two generated import declarations can preserve the source order.

| Execution | Result |
| --- | --- |
| Original ESM in Node | `setup → consumer → local`, success |
| Base CI binding | `setup → consumer → local`, success |
| PR CI binding | `consumer` first, then `consumer ran before setup` |

The comparison covers both `webpack` and `rspack` runtime modes, each with and
without minification. Every build succeeds and produces exactly one output chunk.
The PR-generated chunk imports `consumer.mjs` before `setup.mjs`; the base emits
the reverse order. This breaks initialization patterns such as an external
polyfill imported before a local module that depends on another external package.

`collect_request_order` visits the non-external modules in post-order. It records
local's external consumer before reaching the entry's earlier setup request.
Previously, the external modules themselves contributed imports in dependency
traversal order. Existing PR tests keep their externals directly in one importer,
or put the intermediate module in a separate chunk, so they do not cover this
single-chunk descendant case.

## Run live

On macOS arm64 with Node.js 22.16 or later:

```sh
npm ci --ignore-scripts
gh run download 44509385975 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/base
gh run download 44510670307 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir .bindings/pr
node verify.mjs
```

The verifier always runs the original ESM, builds all eight configurations using
the supplied native bindings, and executes each output in a fresh Node process.
It checks both the emitted import order and the initialization failure. Add
`--record` to refresh `observed.json` and `bundles/`; saved output is never used as
the verifier's input. Set `BASE_BINDING` and `PR_BINDING` to absolute `.node` paths
to use other matching artifacts or local builds. The corresponding Linux and
Windows binding artifacts are available in the same runs; those platforms were
not exercised in this capture.

## Exact revisions

- Reviewed head: `345e82f85244ce7d430bf9b11e4b30cc01a883ac`.
- PR merge base: `6abd4c4e2c57afd007bf979f35afa44a5e8ed464`.
- [PR CI run](https://github.com/web-infra-dev/rspack/actions/runs/44510670307)
  compiled test merge `76a4ebc137e2e2d2d6f8befed5cf8bd317b71353`, whose parents
  are `109b40d7126e38b0bdfe709d116da869cf557e09` and the reviewed head.
- The control uses that exact first parent from
  [base CI run](https://github.com/web-infra-dev/rspack/actions/runs/44509385975).
- Both use the same pinned canary JavaScript wrapper. Its source at
  `ce45cb54e5494c474e34547db06af70664b52081` has identical `packages/rspack` and
  `crates/node_binding` trees to the control revision. The PR changes no JS
  wrapper or binding interface. Published `@rspack/core@2.3.3` lacks the newer
  `output.environment` binding fields, so it cannot substitute for this wrapper.
- Captured on macOS arm64, Node.js 22.16.0. Binary and wrapper SHA-256 hashes and
  artifact IDs are recorded in `provenance.json`.

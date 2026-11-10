# An awaited import cannot catch up to the next compilation

A Node HMR client starts on V1. An editor saves a change to an accepted dependency
(V2), then a change to a lazy chunk (V3), before the client checks for updates.
The V2 accept callback returns a dynamic import of that chunk. Its stable filename
now serves V3, so Rspack must catch up before executing it.

On the merge base the import retries, executes V3, and returns 2. On the reviewed
head the update awaits the import, while version recovery waits for the same
update to leave apply. Both promises reject at the configured chunk-load timeout,
and the runtime remains in apply. The fixture sets the timeout to 500 ms to make
this deterministic and quick. All chunks and hot-update manifests come from
three actual compilations; there are no simulated responses or artificial delays.

The existing `compilerCases/hmr-chunk-versions` test starts an import in the
accept callback, but does not return its promise, so it does not cover the cycle.

## Run

Execute `node verify.mjs` to replay both saved initial bundles with their actual
hot-update files and V3 lazy chunk (Node 22.16.0, macOS ARM64). No install is
needed. Expect the base to finish in idle and the PR to time out in apply.

To regenerate, use the same JS core (its sources do not differ between the two
revisions), with separate native bindings. The PR binding was built locally from
`c8d8b6e3eeceefb740a8941da1f6f51cb21b0296`; the
`43137e1d9c9bb8d2721e1033725d188a4aa3ac68` base binding is artifact
13669766794 from [CI run 42608195021](https://github.com/web-infra-dev/rspack/actions/runs/42608195021).

```sh
RSPACK_BINDING=/path/to/base.node node run.mjs base /path/to/rspack/packages/rspack/dist/index.js
RSPACK_BINDING=/path/to/pr.node node run.mjs pr /path/to/rspack/packages/rspack/dist/index.js
node verify.mjs
```

# A handled synchronous accept error stops all further updates

The entry statically imports a dependency that uses top-level await. It registers
an ordinary (non-async) accept callback and a working third-argument error
handler. The first time the callback runs, it throws a synchronous render error.
The next edit would succeed if the HMR runtime let it run. No callback returns
a rejected promise in the fixture.

| Runtime | First update | Second edit, same process |
| --- | --- | --- |
| Rspack base `43137e1` | Error handler runs, status returns to idle | Accepted |
| Rspack PR `c8d8b6e` | Error handler skipped, check rejects, status stays apply | Check rejected before applying |
| webpack after [#22993](https://github.com/webpack/webpack/pull/22993), `d06b9ea` | Error handler runs, status returns to idle | Accepted |
| webpack 5.112.2 (npm) | Error handler skipped, status stays apply | Check rejected before applying |

The generated async wrapper converts the user's synchronous throw into a rejected
promise. Collecting that promise directly bypasses the accept error handler;
the update exits while the runtime is still in the apply status. The older webpack
release reproduces the bug; webpack subsequently fixed it.

## Verify without a build

From this directory run `node verify.mjs` (tested on Node 22.16.0, macOS ARM64).
It executes all four saved initial bundles and their two emitted hot updates,
checking errors, handler calls, and status. It needs no package installation.

## Regenerate

`fixture/` contains the entire input. `run.mjs` runs one compiler three times,
edits the dependency from 0 to 1 to 2, and calls `module.hot.check(true)` after
each edit. The base is `43137e1d9c9bb8d2721e1033725d188a4aa3ac68`; the PR
is `c8d8b6e3eeceefb740a8941da1f6f51cb21b0296`. The JS core sources are
identical between the two, so the same core built from the PR is used for both.
The base binding is from [CI run 42608195021](https://github.com/web-infra-dev/rspack/actions/runs/42608195021)
(artifact 13669766794). The PR binding was built from the reviewed commit.

Point the following commands to the respective locally built bindings and JS
compiler entry points. For webpack, use release 5.112.2 and a webpack checkout
at `d06b9ea20a3a800c8820bbaaac1d0c352b5aa002` with its dependencies installed.

```sh
RSPACK_BINDING=/path/to/base.node node run.mjs base /path/to/rspack/packages/rspack/dist/index.js
RSPACK_BINDING=/path/to/pr.node node run.mjs pr /path/to/rspack/packages/rspack/dist/index.js
node run.mjs webpack /path/to/webpack-checkout/lib/index.js
node run.mjs webpack-release /path/to/npm/node_modules/webpack/lib/index.js
node verify.mjs
```

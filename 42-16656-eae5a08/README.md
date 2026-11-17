# Restarting an upgrade build fails when its origin returns 503

The first build imports a module from a loopback HTTP server returning `200` with `Cache-Control: max-age=3600`. It commits the lockfile and caches the bytes. A new compiler then builds the same entry immediately with `frozen: true` and `upgrade: true`, while the origin returns `503`. Each bundler generates its own lock and cache in a clean directory; the test never translates the old Rspack format to the new one.

| Build | Requests on restart | Result |
| --- | --- | --- |
| Rspack base | none (stored expiration still fresh) | Bundles `v1` |
| Rspack PR | one; origin returns 503 | Build error, no usable result |
| webpack 5.112.2 | one; origin returns 503 | Bundles the locked `v1` |

As a control, all three succeed without an HTTP request if `upgrade` is switched off. The verifier runs the emitted bundles and checks that the frozen lockfile stays unchanged.

The PR [uses an expiration of zero when its in-memory metadata is empty](https://github.com/web-infra-dev/rspack/blob/eae5a0883638f219c1493631b9108376e2b02b5c/crates/rspack_plugin_schemes/src/http_uri/http_cache.rs#L386-L400). The existing upgrade path then propagates the HTTP error, even though it has already checked the cached content against the lockfile. [webpack handles this refresh failure by returning the checked bytes](https://github.com/webpack/webpack/blob/82b8a9370148cff0158c03ae107042c1be50dfb8/lib/schemes/HttpUriPlugin.js#L1289-L1303); it does not need to persist validators in the shared lockfile to do so.

## Run the live comparison

From this directory with Node.js 22.16 or later on macOS arm64:

```sh
npm ci --ignore-scripts
gh run download 43840155277 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/base
gh run download 43841011941 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D .bindings/pr
node verify.mjs
```

[observed.json](./observed.json) records a run with Node 22.16.0, the published `@rspack/core@2.3.2` JavaScript wrapper for both native artifacts, and webpack 5.112.2. The verifier runs fresh builds instead of replaying this file. Set `BASE_BINDING` and `PR_BINDING` to absolute paths to use matching local builds or another platform. To refresh the evidence after checking both revisions, run `node verify.mjs --record`.

| | CI source | macOS arm64 binding SHA-256 |
| --- | --- | --- |
| [Base job](https://github.com/web-infra-dev/rspack/actions/runs/43840155277/job/133206871102) | `0af9dc77862d81788c5e53d16ea0d3a3886df481` | `c02312a23891b794d75d09e761fb86f3118b0435015287ae35cfee9a459066c6` |
| [PR job](https://github.com/web-infra-dev/rspack/actions/runs/43841011941/job/133209815180) | `7ba6994496f79fa44affc50873126939085caaec` | `5ab77423481acbd3a9ddd28ff554408dae83fe536ed714780827113a115bddff` |

The PR job built the test merge of the base above and [reviewed head `eae5a08`](https://github.com/web-infra-dev/rspack/commit/eae5a0883638f219c1493631b9108376e2b02b5c).

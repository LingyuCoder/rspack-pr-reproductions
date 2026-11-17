# A direct import keeps an outdated redirect alive

An application can import a pinned CDN URL and a floating alias in the same compiler. Their cache lifetimes are independent: a fresh response from `/v1.js` does not tell the compiler whether `/latest.js` still redirects to it.

The verifier starts a loopback HTTP server, uses the default HTTP client, and executes the emitted CommonJS bundle after every successful build. First it generates a real lockfile for `/latest.js → /v1.js`; both responses initially require revalidation. It then moves the alias to `/v2.js`, with the redirect still requiring revalidation. In a new compiler with `upgrade: true`, it builds an entry importing `/v1.js` (now served with `max-age=3600`), then changes the entry to import `/latest.js` and rebuilds in the same compiler.

| Build | Requests when importing the alias | Bundle export | Lockfile target |
| --- | --- | --- | --- |
| Rspack base | `/latest.js`, `/v2.js` | `v2` | `/v2.js` |
| Rspack PR | none | `v1` | `/v1.js` |
| webpack 5.112.2 | `/latest.js`, `/v2.js` | `v2` | `/v2.js` |

On the PR, a fresh compiler that imports the alias without first warming the direct URL returns `v2`. The PR [looks up freshness by the previous resolved URL and integrity](https://github.com/web-infra-dev/rspack/blob/eae5a0883638f219c1493631b9108376e2b02b5c/crates/rspack_plugin_schemes/src/http_uri/http_cache.rs#L386-L400), so one lock entry can short-circuit another. [webpack caches each request URL separately](https://github.com/webpack/webpack/blob/82b8a9370148cff0158c03ae107042c1be50dfb8/lib/schemes/HttpUriPlugin.js#L1141-L1167).

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

# A closer Yarn PnP manifest is ignored after clearCache()

Resolve `dep` from `app/`, initially a directory in a Yarn PnP project. Then
make `app/` a standalone Yarn project with its own lockfile and install. The
parent still depends on v1 and the app now depends on v2. Clear the existing
resolver's cache and repeat the same request from the same directory.

| Resolver | Initially | After install and clearCache() |
| --- | --- | --- |
| Base | dep/index.js (v1) | app/dep/index.js (v2) |
| PR CI merge | dep/index.js (v1) | dep/index.js (v1) |

Both fresh native resolvers and the app's generated Yarn PnP runtime return
`app/dep/index.js` after the install. The previous case (05) changes a dependency
at the same manifest path; here the correct manifest **path** changes. All inputs
are generated in a temporary directory, and both manifests are real Yarn output.
This exercises the native resolver API directly.

Tested on macOS arm64 with Node 22.16.0 and Yarn 4.3.1 (via Corepack). Run
`node verify.mjs` to check the saved captures. Rerun the live comparison with:

```sh
gh run download 42769589391 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D /tmp/pnp-16543-root-base
gh run download 42769901746 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D /tmp/pnp-16543-root-head
node capture.mjs /tmp/pnp-16543-root-base/rspack.darwin-arm64.node
node capture.mjs /tmp/pnp-16543-root-head/rspack.darwin-arm64.node
```

Corepack needs Yarn 4.3.1 available; all fixture dependencies are local portals.
After artifacts expire, supply a native binding built from the matching commit.

- Reviewed [PR #16543](https://github.com/web-infra-dev/rspack/pull/16543)
  at `183d42dba1777e74379b80032f51a981be402bf5`.
- [PR CI checkout](https://github.com/web-infra-dev/rspack/actions/runs/42769901746/job/129676564824):
  `aa3087985e9652ba56c724bc822b3644f6cc7728`, a merge of the reviewed head
  into `d30a883abf352d9bad4ee3809cce42eb049589b7`. Artifact `13741333773`.
- [Base CI](https://github.com/web-infra-dev/rspack/actions/runs/42769589391):
  `d30a883abf352d9bad4ee3809cce42eb049589b7` (the merge's first parent).
  Artifact `13741457138`.

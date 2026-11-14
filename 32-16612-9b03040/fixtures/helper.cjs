exports.loadA = () => {
  globalThis.strictInit = true;
  return import(/* webpackChunkName: "shared" */ './setup-first.mjs');
};

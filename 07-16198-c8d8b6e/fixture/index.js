require("./dep.js");
let lazy;
module.hot.accept("./dep.js", () => {
  require("./dep.js");
  lazy = import(/* webpackChunkName: "lazy" */ "./lazy.js").then(m => m.default);
  return lazy;
});
exports.update = () => module.hot.check(true);
exports.getLazy = () => lazy;
exports.status = () => module.hot.status();

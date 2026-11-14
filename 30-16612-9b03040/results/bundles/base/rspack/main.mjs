import * as __rspack_external__x_cjs_efc618d8 from "./x.cjs";

var modules = {};
// The module cache
var moduleCache = {};
// The require function
function rspackRequire(moduleId) {
// Check if module is in cache
var cachedModule = moduleCache[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (moduleCache[moduleId] = {
exports: {}
});
// Execute the module function
modules[moduleId](module, module.exports, rspackRequire);

// Return the exports of the module
return module.exports;
}
// expose the modules object (modules)
var moduleFactories = modules;

// rspack/runtime/esm_register_module
moduleFactories.add = function registerModules(modules) { Object.assign(moduleFactories, modules) }
;

moduleFactories.add({
"./x.cjs?8c8a"(module) {

module.exports = __rspack_external__x_cjs_efc618d8;


},
"./helper.cjs"() {
rspackRequire("./x.cjs?8c8a");


},
});


rspackRequire("./helper.cjs");




export { z } from "./z.mjs";

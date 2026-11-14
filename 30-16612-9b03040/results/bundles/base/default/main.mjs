import * as __rspack_external__x_cjs_efc618d8 from "./x.cjs";

var __webpack_modules__ = {};
// The module cache
var __webpack_module_cache__ = {};
// The require function
function __webpack_require__(moduleId) {
// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;
}
// expose the modules object (__webpack_modules__)
__webpack_require__.m = __webpack_modules__;

// webpack/runtime/esm_register_module
(() => {
__webpack_require__.add = function registerModules(modules) { Object.assign(__webpack_require__.m, modules) }

})();

__webpack_require__.add({
"./x.cjs?8c8a"(module) {

module.exports = __rspack_external__x_cjs_efc618d8;


},
"./helper.cjs"(__unused_rspack_module, __unused_rspack_exports, __webpack_require__) {
__webpack_require__("./x.cjs?8c8a");


},
});


__webpack_require__("./helper.cjs");




export { z } from "./z.mjs";

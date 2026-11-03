(() => {
var __webpack_modules__ = ({
298(__unused_rspack_module, exports, __webpack_require__) {
exports.data = __webpack_require__(306);


},
306(module) {
"use strict";
module.exports = {"longProperty":42}

},

});
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

var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
console.log("value=" + (__webpack_require__(298)/* .data.longProperty */.data.longProperty));
console.log("owns=" + (__webpack_require__(298)/* .data.hasOwnProperty */.data.hasOwnProperty)("longProperty"));

})();

})()
;
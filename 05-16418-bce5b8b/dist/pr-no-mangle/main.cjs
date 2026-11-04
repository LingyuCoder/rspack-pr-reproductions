(() => {
"use strict";
var __webpack_modules__ = ({
306(module) {
module.exports = {"run":null}

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

// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/* import */ var _data_json__rspack_import_0 = __webpack_require__(306);


_data_json__rspack_import_0.run = function () {
  return this.kept;
};

console.log("value=" + _data_json__rspack_import_0.run());

})();

})()
;
"use strict";
exports.ids = ["main"];
exports.modules = {
"./dep.js"(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.a(module, async function (__rspack_load_async_deps, __rspack_async_done) { try {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  value: () => (value)
});
const value = await Promise.resolve(1);

__rspack_async_done();
} catch(e) { __rspack_async_done(e); } }, 1);

},

};
exports.runtime = function(__webpack_require__) {
// webpack/runtime/get_full_hash
(() => {
__webpack_require__.h = () => ("4aa38a5403953151")
})();

}
;
;
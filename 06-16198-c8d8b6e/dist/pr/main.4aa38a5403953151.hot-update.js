"use strict";
exports.ids = ["main"];
exports.modules = {
"./dep.js"(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.a(module, async function (__rspack_load_async_deps, __rspack_async_done) { try {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  value: () => (value)
});
const value = await Promise.resolve(2);

__rspack_async_done();
} catch(e) { __rspack_async_done(e); } }, 1);

},

};
exports.runtime = function(__webpack_require__) {
// webpack/runtime/get_full_hash
(() => {
__webpack_require__.h = () => ("d7b4e23d85f2c08e")
})();

}
;
;
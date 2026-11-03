export const __rspack_esm_ids = ["main"];
export const __webpack_modules__ = {
"./entry.js"(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.a(module, async function (__rspack_load_async_deps, __rspack_async_done) { try {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  then: () => (then),
  value: () => (value)
});
let then;
const value = 42;

await Promise.resolve();
queueMicrotask(() => {
  then = () => {
    throw new Error("unexpected then");
  };
});

__rspack_async_done();
} catch(e) { __rspack_async_done(e); } }, 1);

},

};
import { __webpack_require__ } from './runtime.mjs';
var __webpack_exec__ = function(moduleId) { return __webpack_require__(__webpack_require__.s = moduleId); }
import * as __rspack_chunk_1 from './main.mjs';
__webpack_require__.C(__rspack_chunk_1);
var __webpack_exports__ = __webpack_exec__("./entry.js");
__webpack_exports__ = await __webpack_exports__;__webpack_exports__ = await __webpack_exports__;
var __webpack_exports__then = __webpack_exports__.then;
var __webpack_exports__value = __webpack_exports__.value;
export { __webpack_exports__then as then, __webpack_exports__value as value };

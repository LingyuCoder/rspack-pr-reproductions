/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 298
(__unused_webpack_module, exports, __webpack_require__) {

exports.data = __webpack_require__(306);


/***/ },

/***/ 306
(module) {

"use strict";
module.exports = {"longProperty":42};

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
console.log("value=" + (__webpack_require__(298).data.longProperty));
console.log("owns=" + (__webpack_require__(298).data).hasOwnProperty("longProperty"));

/******/ })()
;
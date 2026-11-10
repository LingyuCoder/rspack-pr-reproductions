import { value } from "./dep.js";

const events = [];
let first = true;
module.hot.accept("./dep.js", () => {
  if (first) {
    first = false;
    throw new Error("render failed");
  }
  events.push("accepted");
}, err => events.push("handled: " + err.message));

export const current = () => value;
export const update = () => module.hot.check(true);
export const state = () => ({ status: module.hot.status(), events: events.slice() });

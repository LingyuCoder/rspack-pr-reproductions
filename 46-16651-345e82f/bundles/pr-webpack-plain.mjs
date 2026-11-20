import "./consumer.mjs";
import "./setup.mjs";






(globalThis.order ??= []).push("local");



const ready = true;

export { ready };

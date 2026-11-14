globalThis.order.push('x');
if (globalThis.strictInit && !globalThis.setupReady) {
  throw new Error('setup must run before x');
}
export const x = 1;

if (!globalThis.order.includes('x')) {
  throw new Error('x has not initialized');
}
globalThis.order.push('z');
export const z = 1;

globalThis.order.push('z');
if (!globalThis.order.includes('x')) throw Error('x is not initialized');
export const z = 1;

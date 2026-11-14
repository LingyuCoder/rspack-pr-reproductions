globalThis.marker = 1;

if (!globalThis.order.includes('z')) throw new Error('setup must precede c');
globalThis.order.push('c');

export {};

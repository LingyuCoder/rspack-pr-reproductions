if (!globalThis.order.includes('z')) throw new Error('setup must precede c');
globalThis.order.push('c');

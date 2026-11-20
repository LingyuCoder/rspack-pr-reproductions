(globalThis.order ??= []).push("consumer");
if (!globalThis.setupReady) throw new Error("consumer ran before setup");

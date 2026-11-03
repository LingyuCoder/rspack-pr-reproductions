export let then;
export const value = 42;

await Promise.resolve();
queueMicrotask(() => {
  then = () => {
    throw new Error("unexpected then");
  };
});

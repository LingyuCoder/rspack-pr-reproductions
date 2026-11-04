import { fileURLToPath } from "node:url";

export default {
  context: fileURLToPath(new URL(".", import.meta.url)),
  mode: "production",
  target: "node",
  devtool: false,
  entry: "./entry.mjs",
  output: { filename: "main.cjs" },
  optimization: { minimize: false, concatenateModules: false },
};

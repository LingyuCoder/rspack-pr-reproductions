import { fileURLToPath } from "node:url";

export default {
  context: fileURLToPath(new URL(".", import.meta.url)),
  mode: "production",
  target: "node",
  devtool: false,
  entry: "./entry.cjs",
  output: { filename: "main.cjs" },
  optimization: { minimize: false, mangleExports: true },
};

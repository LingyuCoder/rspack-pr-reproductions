import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default {
  context: root,
  mode: "development",
  target: "node",
  devtool: false,
  entry: "./entry.js",
  output: {
    path: path.join(root, "dist", "pr-split"),
    module: true,
    filename: "[name].mjs",
    library: { type: "module" },
    environment: { topLevelAwait: true },
  },
  optimization: { runtimeChunk: "single" },
};

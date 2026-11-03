import { fileURLToPath } from "node:url";

export default {
  context: fileURLToPath(new URL(".", import.meta.url)),
  mode: "production",
  target: "node",
  devtool: false,
  entry: { a: "./a.cjs", b: "./b.cjs" },
  output: { filename: "[name].cjs" },
  module: { generator: { json: { JSONParse: false } } },
  optimization: {
    usedExports: true,
    mangleExports: false,
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
    concatenateModules: false,
  },
};

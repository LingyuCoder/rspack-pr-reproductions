const path = require('node:path');
const { rspack } = require(process.env.RSPACK_CORE || '@rspack/core');
const compiler = rspack({
  context: __dirname, mode: 'development', cache: false,
  entry: ['./a.js', './b.js'], devtool: false,
  output: { path: path.join(require('node:os').tmpdir(),'rspack-16580-delayed-import-output'),filename: 'main.js' },
  module: { rules: [{ test: /[ab]\.js$/, use: path.join(__dirname,'minimal-loader.cjs') }] },
  plugins: [{ apply(compiler) {
    compiler.hooks.thisCompilation.tap('repro', compilation => {
      compilation.hooks.succeedModule.tap('repro', module => {
        if (process.env.NO_FAILURE !== '1' && module.resource?.endsWith('/a.js')) throw new Error('intentional hook failure');
      });
    });
  }}],
});
compiler.run(err => {
  console.log('run callback:', err ? 'expected hook error' : 'success');
  setTimeout(() => compiler.close(() => console.log('closed without crashing')), 700);
});

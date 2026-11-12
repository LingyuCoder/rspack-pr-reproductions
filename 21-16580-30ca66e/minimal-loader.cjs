module.exports = function(source) {
  const callback = this.async();
  const isB = this.resourcePath.endsWith('/b.js');
  const delay = isB ? Number(process.env.IMPORT_DELAY || 300) : Number(process.env.FAIL_DELAY || 50);
  if (isB) console.log('async loader started');
  setTimeout(async () => {
    if (isB) {
      console.log('async loader importing');
      try {
        const value = await this.importModule(require('node:path').join(__dirname,'payload.js'));
        console.log('import completed:', value);
      } catch(error) { console.log('import rejected:', error.message); }
    }
    callback(null,source);
  },delay);
};

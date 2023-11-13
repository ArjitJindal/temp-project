const path = require('path');

module.exports = {
  process(sourceText, sourcePath, _options) {
    const keyPrefix = path.relative(process.cwd(), sourcePath).replace(/[^a-zA-Z]/g, '_');
    /*
      We are using proxy here to resolve all the css-module classes to strings like "src_path_to_component__{className}",
      so when we import css module in tests and use class like `<div className={s.root}` then `s.root` will
      resolve to "src_path_to_component__root"
     */
    return {
      code: `
    module.exports = new Proxy({}, {
      get: function getter(target, key) {
        if (key === '__esModule') {
          return false;
        }
        return '${keyPrefix}' + '___' + key;
      }
    })
`,
    };
  },
};

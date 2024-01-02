const path = require('path');
const less = require('less');
const { convertLessError } = require('../build/less-utils');

function renderLessSync(sourceText, opts) {
  let results;
  less.render(
    sourceText,
    {
      ...opts,
      syncImport: true,
    },
    (error, result) => {
      results = { error, result };
    },
  );
  if (results == null) {
    throw new Error(
      `This can only happen if less is run in asynchronous mode, which should not happen when we pass a callback`,
    );
  }
  const { error, result } = results;
  if (error) {
    throw new Error(
      `Error while running LESS compilation. ${JSON.stringify(convertLessError(error))}}`,
    );
  }
  return result;
}

module.exports = {
  process(sourceText, sourcePath, _options) {
    const keyPrefix = path.relative(process.cwd(), sourcePath).replace(/[^a-zA-Z]/g, '_');

    let { css } = renderLessSync(sourceText, {
      filename: sourcePath,
    });
    css = css.replaceAll(/\.([a-zA-Z0-9-_]+)/g, `.${keyPrefix}___$1`);
    /*
      We are using proxy here to resolve all the css-module classes to strings like "src_path_to_component__{className}",
      so when we import css module in tests and use class like `<div className={s.root}` then `s.root` will
      resolve to "src_path_to_component__root"
     */
    return {
      code: `
    module.exports = new Proxy({}, {
      get: function getter(target, key) {
        if (!this.styleAppended) {
          const el = document.createElement('style')
          el.textContent = \`${css}\`
          document.body.appendChild(el);
          this.styleAppended = true;
        }
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

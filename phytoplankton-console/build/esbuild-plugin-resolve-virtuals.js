/* eslint-disable */
const tmp = require('tmp');
const path = require('path');
const fs = require('fs-extra');

/*
  Resolve all unhandled virtual files to usual files in temporary directory
 */
module.exports = (options = {}, loaderOptions = {}) => {
  return {
    name: 'resolve-virtuals',
    setup: (build) => {
      const tmpDirPath = tmp.dirSync().name;

      build.onResolve({ filter: /^virtual:.*/ }, async (args) => {
        const { pluginData, resolveDir } = args;
        const { contents } = pluginData;
        const relativeFilePath = path.relative(resolveDir, pluginData.path);
        const tmpFilePath = path.resolve(tmpDirPath, relativeFilePath);
        await fs.ensureDir(path.dirname(tmpFilePath));
        await fs.writeFile(tmpFilePath, contents);

        return {
          path: tmpFilePath,
        };
      });
    },
  };
};

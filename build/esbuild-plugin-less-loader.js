/* eslint-disable */
const { Buffer } = require('buffer');
const { createHash } = require('crypto');

const path = require('path');
const tmp = require('tmp');
const fs = require('fs-extra');
const less = require('less');
const { convertLessError, getLessImports } = require('./less-utils');

/*
  Loads its results into virtual files to make it possible to handle them in other plugins
 */
module.exports = (options = {}, loaderOptions = {}) => {
  return {
    name: 'less-loader',
    setup: (build) => {
      const filter = loaderOptions.filter;
      const rootDir = loaderOptions.rootDir;
      const cache = new Map();

      // Resolve *.less files with namespace
      build.onResolve({ filter: filter || /\.less$/ }, async (args) => {
        const absoluteFilePath = path.resolve(
          process.cwd(),
          path.relative(process.cwd(), args.resolveDir),
          args.path,
        );
        const isExternal =
          args.path.startsWith('~') || absoluteFilePath.indexOf('node_modules') !== -1;
        const dir = path.dirname(absoluteFilePath);

        const opts = {
          filename: absoluteFilePath,
          relativeUrls: true,
          ...options,
          paths: [...(options.paths || []), dir],
        };

        let css;
        const cached = cache.get(absoluteFilePath);
        if (isExternal && cached) {
          css = cached;
        } else {
          const content = await fs.readFile(absoluteFilePath, 'utf-8');
          try {
            const lessResult = await less.render(content, opts);
            css = lessResult.css;
            cache.set(absoluteFilePath, css);
          } catch (e) {
            return {
              errors: [convertLessError(e)],
            };
          }
        }

        const relativeFilePath = path.relative(rootDir, absoluteFilePath);
        const newRelativeFilePath = relativeFilePath.replace(/\.less$/, '.css');

        return {
          path: newRelativeFilePath,
          watchFiles:
            !isExternal && !!build.initialOptions.watch
              ? [absoluteFilePath, ...getLessImports(absoluteFilePath)]
              : undefined,
          namespace: 'less-loader',
          pluginData: {
            virtualFilePath: newRelativeFilePath,
            contents: css,
          },
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'less-loader' }, async (args) => {
        return {
          resolveDir: rootDir,
          pluginData: {
            path: args.pluginData.virtualFilePath,
            contents: args.pluginData.contents,
          },
          contents: `
            import _default from "virtual:${args.path}"
            export default _default
          `,
        };
      });
    },
  };
};

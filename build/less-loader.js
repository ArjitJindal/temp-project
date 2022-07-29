/* eslint-disable */
const { Buffer } = require('buffer');
const { createHash } = require('crypto');

const path = require('path');
const tmp = require('tmp');
const fs = require('fs-extra');
const less = require('less');
const { convertLessError, getLessImports } = require('./less-utils');
const csstree = require('css-tree');

function interpolatePattern(string, replacer) {
  let result = '';
  let rest = string;
  while (rest !== '') {
    let match = rest.match(/(\[.+?\])/);
    if (match != null) {
      const text = match[0];
      const index = match.index ?? 0;
      let match1 = text.match(/^\[(.+)\]$/);
      if (match1 == null) {
        // todo: could this happen?
        throw new Error(`Unexpected case`);
      }
      const [name, ...params] = match1[1].split(':');
      const replacedString = replacer(name, params);
      result += rest.substr(0, index) + (replacedString == null ? text : replacedString);
      rest = rest.substr(index + text.length);
    } else {
      result += rest;
      rest = '';
    }
  }
  return result;
}

function makeNameHash(name, maxLength = 32, type = 'md4', digest = 'hex') {
  const buffer = Buffer.from(name, 'utf8');

  const hash = createHash(type);
  hash.update(buffer);

  return `h${hash.digest(digest).substr(0, maxLength)}`;
}

function escapeClassName(string) {
  return string.replace(/^[^a-zA-Z_]/g, '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

const MODULES_EXTENSION = '.module.less';
const localIdentName = '[folder]__[local]--[hash:8:md5:hex]'; // todo: use different for production

const tmpDirPath = tmp.dirSync().name;

async function handleCssModules(rootDir, args, cssResult) {
  try {
    const parsed = path.parse(args.path);
    const baseName = parsed.name;
    const folderName = path.basename(path.dirname(args.path));
    const relativeDir = path.relative(rootDir, path.dirname(args.path));
    const extName = parsed.ext;
    const preparedLocalIdentName = interpolatePattern(localIdentName, (name) => {
      switch (name) {
        case 'ext':
          return escapeClassName(extName);
        case 'name':
          return escapeClassName(baseName);
        case 'path':
          return escapeClassName(args.path);
        case 'folder':
          return escapeClassName(folderName);
      }
      return null;
    });

    const ast = csstree.parse(cssResult);
    const classMap = {};
    let isGlobal = false;
    csstree.walk(ast, {
      enter(node, item, list) {
        if (node.type === 'ClassSelector' && !isGlobal) {
          const newClassname = interpolatePattern(preparedLocalIdentName, (name, params) => {
            switch (name) {
              case 'local':
                return node.name;
              case 'hash': {
                const [lengthRaw, hashType, digestType] = params;

                return makeNameHash(
                  args.path + ':' + node.name,
                  parseInt(lengthRaw),
                  hashType,
                  digestType,
                );
              }
            }
            return null;
          });
          classMap[node.name] = newClassname;
          node.name = newClassname;
        } else if (node.type === 'PseudoClassSelector' && node.name === 'global') {
          isGlobal = true;
        }
      },
      leave(node, item, list) {
        if (node.type === 'Selector') {
          isGlobal = false;
        }
      },
    });

    const baseFileName = path.basename(args.path, extName);
    const tmpFilePath = path.resolve(tmpDirPath, relativeDir, `${baseFileName}.css`);

    await fs.ensureDir(path.dirname(tmpFilePath));
    let css = csstree.generate(ast);
    if (css.indexOf(':global') !== -1) {
      css = css.replace(/:global/g, ' ');
    }
    await fs.writeFile(tmpFilePath, css);

    let contents = `
          import "${tmpFilePath}";
          const result = ${JSON.stringify(classMap)};
          export default result;
        `;

    return {
      contents: contents,
    };
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = (options = {}, loaderOptions = {}) => {
  return {
    name: 'less-loader',
    setup: (build) => {
      const filter = loaderOptions.filter;
      const rootDir = loaderOptions.rootDir;
      const cache = new Map();

      // Resolve *.less files with namespace
      build.onResolve({ filter: filter || /\.less$/, namespace: 'file' }, (args) => {
        const filePath = path.resolve(
          process.cwd(),
          path.relative(process.cwd(), args.resolveDir),
          args.path,
        );
        const isExternal = filePath.indexOf('node_modules') !== -1;
        return {
          path: filePath,
          watchFiles:
            !isExternal && !!build.initialOptions.watch
              ? [filePath, ...getLessImports(filePath)]
              : undefined,
        };
      });

      // Build .less files
      build.onLoad({ filter: filter || /\.less$/, namespace: 'file' }, async (args) => {
        const cacheKey = args.path;
        const cached = cache.get(cacheKey);
        if (cached) {
          return cached;
        }

        const isExternal = args.path.startsWith('~') || args.path.indexOf('node_modules') !== -1;
        const isModule = !isExternal && args.path.endsWith(MODULES_EXTENSION);
        const dir = path.dirname(args.path);

        //
        // if (isExternal) {
        //   return {
        //     contents: '',
        //     loader: 'css',
        //     resolveDir: dir,
        //   };
        // }

        const opts = {
          filename: args.path,
          relativeUrls: true,
          ...options,
          paths: [...(options.paths || []), dir],
        };

        let result;
        try {
          // console.log(`[less-plugin-patched] Rebuilding ${args.path}`);
          const content = await fs.readFile(args.path, 'utf-8');
          const { css } = await less.render(content, opts);
          // console.log(`[less-plugin-patched] Rebuilding ${args.path} done`);

          if (isModule) {
            result = handleCssModules(rootDir, args, css);
          } else {
            result = {
              contents: css,
              loader: 'css',
              resolveDir: dir,
            };
          }
        } catch (e) {
          result = {
            errors: [convertLessError(e)],
            resolveDir: dir,
          };
        }
        if (isExternal) {
          cache.set(cacheKey, result);
        }
        return result;
      });
    },
  };
};

/* eslint-disable */
const { Buffer } = require('buffer');
const { createHash } = require('crypto');

const path = require('path');
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

const MODULES_EXTENSION = '.module.css';
const localIdentName = '[folder]__[local]--[hash:8:md5:hex]'; // todo: use different for production

async function handleCssModules(args, cssResult) {
  try {
    const parsed = path.parse(args.path);
    const baseName = parsed.name;
    const folderName = path.basename(path.dirname(args.path));
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

    let css = csstree.generate(ast);
    if (css.indexOf(':global') !== -1) {
      css = css.replace(/:global/g, ' ');
    }

    return {
      css,
      classMap,
    };
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = (options = {}, loaderOptions = {}) => {
  return {
    name: 'css-modules',
    setup: (build) => {
      const cache = new Map();

      build.onResolve({ filter: /virtual:.*\.module\.css$/ }, async (args) => {
        return {
          path: args.pluginData.path,
          namespace: 'css-modules',
          pluginData: args.pluginData,
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'css-modules' }, async (args) => {
        const cacheKey = args.path;
        const cached = cache.get(cacheKey);
        if (cached) {
          return cached;
        }

        const content = args.pluginData.contents;
        const { css, classMap } = await handleCssModules(args, content);

        const newPath = args.path.replace(MODULES_EXTENSION, '.css');
        return {
          resolveDir: args.pluginData.resolveDir,
          pluginData: {
            path: newPath,
            resolveDir: args.pluginData.resolveDir,
            contents: css,
          },
          contents: `
            import "virtual:${newPath}";
            const result = ${JSON.stringify(classMap)};
            export default result;
          `,
        };
      });
    },
  };
};

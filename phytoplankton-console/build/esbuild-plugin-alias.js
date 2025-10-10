/*
  esbuild-plugin-alias.js
  ----------------------
  Super-lightweight alias plugin. Currently redirects `lodash` → `lodash-es` so that esbuild can
  tree-shake individual lodash functions instead of bundling the whole commonjs build.
*/

function aliasPlugin() {
  return {
    name: 'alias-plugin',
    setup(build) {
      build.onResolve({ filter: /^lodash$/ }, () => ({
        path: require.resolve('lodash-es'),
      }));

      // Alias deep imports like "lodash/debounce" → "lodash-es/debounce"
      build.onResolve({ filter: /^lodash\// }, (args) => {
        const subPath = args.path.substring('lodash/'.length);
        return { path: require.resolve(`lodash-es/${subPath}`) };
      });

      // Ensure lodash-es deep imports resolve correctly when missing export map.
      build.onResolve({ filter: /^lodash-es\/.*$/ }, (args) => {
        return { path: require.resolve(args.path) };
      });
    },
  };
}

module.exports = aliasPlugin;

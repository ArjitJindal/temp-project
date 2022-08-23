/* eslint-disable */
const svgr = require('@svgr/core').transform;
const fs = require('fs');

module.exports = (options = {}) => ({
  name: 'svgr',
  setup(build) {
    build.onLoad({ filter: /\.react\.svg$/ }, async (args) => {
      const svg = await fs.promises.readFile(args.path, 'utf8');
      const contents = await svgr(svg, { ...options }, { filePath: args.path });
      return {
        contents,
        loader: 'tsx',
      };
    });
  },
});

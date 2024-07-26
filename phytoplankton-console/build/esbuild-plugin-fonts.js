/* eslint-disable */
const fs = require('fs');
const path = require('path');

// Custom plugin to manage font files
module.exports = (options = {}, loaderOptions = {}) => ({
  name: 'fonts',
  setup(build) {
    const rootDir = loaderOptions.rootDir || 'src'; // defaulting to 'src' if not provided
    const outputBase = loaderOptions.outputBase || 'dist'; // default output directory

    build.onResolve({ filter: /\.ttf$/ }, (args) => {
      const absoluteFilePath = path.resolve(args.resolveDir, args.path);
      const relativeFilePath = path.relative(rootDir, absoluteFilePath);

      // Return a custom namespace for fonts with a resolved path
      return { path: relativeFilePath, namespace: 'fonts' };
    });

    build.onLoad({ filter: /.*/, namespace: 'fonts' }, async (args) => {
      const filePath = path.join(rootDir, args.path); // Construct the absolute path based on the root directory
      const data = await fs.promises.readFile(filePath);

      // Determine the destination path in the output directory
      const outputPath = path.relative(rootDir, path.basename(args.path));
      const outputDir = path.join(outputBase, outputPath);

      // Ensure directory exists and write the font file
      await fs.promises.mkdir(path.dirname(outputDir), { recursive: true });
      await fs.promises.writeFile(outputDir, data);

      // Return an export path to be used in the application
      // The path should be relative to the outputBase and should be a URL path, not a filesystem path
      const publicPath = `/${outputPath.replace(/\\/g, '/')}`; // Ensure the path is in URL format
      console.log(publicPath);

      return {
        contents: `export default "${publicPath}"`,
        loader: 'js',
      };
    });
  },
});

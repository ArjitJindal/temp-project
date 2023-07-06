module.exports = {
  process(sourceText, sourcePath, _options) {
    return {
      code: `module.exports = '${sourcePath}';`,
    };
  },
};

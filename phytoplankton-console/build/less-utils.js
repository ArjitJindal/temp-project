/* eslint-disable */
const fs = require('fs');
const path = require('path');

const importRegex = /@import.*?["']([^"']+)["'].*?/;
const globalImportRegex = /@import.*?["']([^"']+)["'].*?/g;
const importCommentRegex = /(?:\/\*(?:[\s\S]*?)\*\/)|(\/\/(?:.*)$)/gm;

const extWhitelist = ['.css', '.less'];

/** Recursively get .less/.css imports from file */
const getLessImports = (filePath) => {
  try {
    const dir = path.dirname(filePath);
    const content = fs.readFileSync(filePath).toString('utf8');

    const cleanContent = content.replace(importCommentRegex, '');
    const match = cleanContent.match(globalImportRegex) || [];

    const fileImports = match
      .map((el) => {
        const match = el.match(importRegex);
        return match[1];
      })
      .filter((el) => !!el)
      // NOTE: According to the docs, extensionless imports are interpreted as '.less' files.
      // http://lesscss.org/features/#import-atrules-feature-file-extensions
      // https://github.com/iam-medvedev/esbuild-plugin-less/issues/13
      .map((el) => path.resolve(dir, path.extname(el) ? el : `${el}.less`));

    const recursiveImports = fileImports.reduce((result, el) => {
      return [...result, ...getLessImports(el)];
    }, fileImports);

    const result = recursiveImports.filter((el) =>
      extWhitelist.includes(path.extname(el).toLowerCase()),
    );

    return result;
  } catch (e) {
    return [];
  }
};

/** Convert less error into esbuild error */
const convertLessError = (error) => {
  const sourceLine = error.extract.filter((line) => line);
  const lineText = sourceLine.length === 3 ? sourceLine[1] : sourceLine[0];

  return {
    text: error.message,
    location: {
      namespace: 'file',
      file: error.filename,
      line: error.line,
      column: error.column,
      lineText,
    },
  };
};

module.exports = { getLessImports, convertLessError };

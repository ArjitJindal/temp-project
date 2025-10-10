const path = require('path');

module.exports = {
  process(sourceText, sourcePath, _options) {
    return {
      code: `
    const React = require('react')
    module.exports = (props) => React.createElement('svg', props);
`,
    };
  },
};

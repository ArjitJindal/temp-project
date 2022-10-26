const fabric = require('@umijs/fabric');

console.log('fabric.stylelint', fabric.stylelint);

module.exports = {
  ...fabric.stylelint,
  rules: {
    ...fabric.stylelint.rules,
    'block-no-empty': null,
  },
};

module.exports = {
  extends: [
    'stylelint-config-recommended', // Essential baseline.
    'stylelint-config-standard', // Common standard practices.
    'stylelint-config-css-modules', // For handling CSS Modules better.
    'stylelint-config-prettier', // Integrate Prettier seamlessly.
  ],
  plugins: [
    'stylelint-declaration-block-no-ignored-properties', // Plugin example.
  ],
  rules: {
    'block-no-empty': null, // disable block-no-empty check.
    'no-descending-specificity': null, // Disable specificity rules.
    'function-url-quotes': 'always', // Ensure quotes around URL.
    'selector-attribute-quotes': 'always',
    'selector-class-pattern': null,
    'font-family-no-missing-generic-family-keyword': null, // Iconfont.
    'plugin/declaration-block-no-ignored-properties': true,
    'unit-no-unknown': [true, { ignoreUnits: ['rpx'] }],
    'selector-type-no-unknown': null,
    'value-keyword-case': ['lower', { ignoreProperties: ['composes'] }],
  },
  overrides: [
    {
      files: ['*.less', '**/*.less'],
      customSyntax: 'postcss-less',
    },
  ],
  ignoreFiles: ['**/*.js', '**/*.jsx', '**/*.tsx', '**/*.ts'],
};

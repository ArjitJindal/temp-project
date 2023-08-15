module.exports = {
  parser: '@typescript-eslint/parser',
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  ignorePatterns: ['.eslintrc.js', 'cdk.out', 'dist', 'node_modules'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'import/no-unresolved': [
      'error',
      {
        ignore: ['aws-lambda', '@/*', '@cdk/*'],
      },
    ],
    'import/order': 'error',
    // TODO: to be changed to 'error' in FR-2981
    'import/no-cycle': 'warn',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
    "@typescript-eslint/switch-exhaustiveness-check": "error"
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
}

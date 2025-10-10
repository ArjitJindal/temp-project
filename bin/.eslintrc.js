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
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': [
      'warn'
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'import/order': 'error',
    'import/no-cycle': 'warn',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
    project: './tsconfig.json',    // Points to bin/tsconfig.json
    tsconfigRootDir: __dirname,    // Will resolve to the bin directory
  },
} 
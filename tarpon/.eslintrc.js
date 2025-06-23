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
    'valid-typeof': 'off',
    '@typescript-eslint/no-explicit-any': [
        'warn'
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'import/no-unresolved': [
      'error',
      {
        ignore: ['aws-lambda', '@/*', '@cdk/*', 'pdfmake/interfaces'],
      },
    ],
    'import/order': 'error',
    // TODO: to be changed to 'error' in FR-2981
    'import/no-cycle': 'warn',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src',
            from: './scripts',
          }
        ]
      }
    ],
    "curly": "error",
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['src/utils/**/*.{js,ts,tsx}', 'src/core/**/*.{js,ts,tsx}', 'src/services/copilot/**/*.{js,ts,tsx}', 'src/services/metrics/**/*.{js,ts,tsx}', 'src/services/sanctions/**/*.{js,ts,tsx}'],
      rules: {
        'import/no-cycle': 'error',
      },
    },
  ],
}

/** @type {import('ts-jest').JestConfigWithTsJest} */

// Some modules are published in ESM-format, need to manually un-ignore it from transformation
const includeEsModules = [
  'nanoid',
  'antd',
  '@babel/runtime',
  '@ant-design/icons',
  'rc-[a-z]+',
  'mime',
  'marked',
];

process.env.TZ = 'Etc/UTC';

module.exports = {
  globals: {
    API_BASE_PATH: '',
    AUTH0_AUDIENCE: '',
    AUTH0_DOMAIN: '',
    AUTH0_CLIENT_ID: '',
    FEATURES_ENABLED: '',
    EXPORT_ENTRIES_LIMIT: '',
    SENTRY_DSN: '',
    SLACK_CLIENT_ID: '',
    IS_SENTRY_INSTANCE: '',
  },
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  moduleDirectories: ['node_modules', 'jest'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^~antd/(.*)$': '<rootDir>/node_modules/antd/$1',
    '^@flagright/(.*)$': '<rootDir>/../$1',
    '^(.+\\.module\\.(?:less|css))$': '$1',
    '^.+\\.(less|css|ttf)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.module\\.less$': './jest/jest-react-less-modules-transformer.js',
    '^.+\\.react\\.svg$': './jest/jest-react-svg-transformer.js',
    '^.+\\.(svg|png)$': './jest/jest-react-file-transformer.js',
    '^.+\\.(([tj]sx?))$': [
      'esbuild-jest',
      {
        sourcemap: true,
      },
    ],
  },
  transformIgnorePatterns: [`node_modules/(?!${includeEsModules.join('|')})`],
  setupFilesAfterEnv: ['<rootDir>/jest/jest-setup.ts'],
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'json-summary'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/src/apis/**',
    '!**/cypress/**',
    '!**/jest/**',
    '!**/@types/**',
    '!**/cypress.config.ts',
  ],
};

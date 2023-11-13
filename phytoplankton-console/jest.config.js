/** @type {import('ts-jest').JestConfigWithTsJest} */

// Some modules are published in ESM-format, need to manually un-ignore it from transformation
const includeEsModules = ['nanoid', 'antd', '@babel/runtime', '@ant-design/icons', 'rc-[a-z]+'];

process.env.TZ = 'Etc/UTC';

module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  moduleDirectories: ['node_modules', 'jest'],
  moduleNameMapper: {
    '^.+[^e]\\.less$': 'identity-obj-proxy',
    '@/(.*)': '<rootDir>/src/$1',
    '@flagright/(.*)': '<rootDir>/../$1',
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
  setupFilesAfterEnv: ['<rootDir>/jest/jest-setup.js'],
};

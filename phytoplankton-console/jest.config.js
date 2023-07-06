/** @type {import('ts-jest').JestConfigWithTsJest} */

// Some modules are published in ESM-format, need to manually un-ignore it from transformation
const includeEsModules = ['nanoid', 'antd', '@babel/runtime', '@ant-design/icons', 'rc-[a-z]+'];

module.exports = {
  testEnvironment: 'jsdom',
  moduleDirectories: ['node_modules', 'jest'],
  moduleNameMapper: {
    '^.+\\.less$': 'identity-obj-proxy',
    '@/(.*)': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.react.svg$': './jest/jest-react-svg-transformer.js',
    '^.+\\.svg$': './jest/jest-react-file-transformer.js',
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

import type { Config } from 'jest'

const includeEsModules = ['marked']

const config: Config = {
  testTimeout: 120000,
  preset: 'ts-jest',
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@lib/(.*)': '<rootDir>/lib/$1',
  },
  testMatch: ['<rootDir>/**/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest-setup.ts'],
  globalTeardown: '<rootDir>/jest-teardown.ts',
  globals: {
    'ts-jest': {
      isolatedModules: true,
      allowJs: true,
    },
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: false,
        allowJs: true,
      },
    ],
  },
  transformIgnorePatterns: [`node_modules/(?!${includeEsModules.join('|')})`],
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/lambdas/**/*.ts',
    '<rootDir>/src/services/**/*.ts',
    '<rootDir>/src/utils/**/*.ts',
    '<rootDir>/src/fargate/**/*.ts',
    '<rootDir>/src/core/**/*.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['json-summary'],
  coverageProvider: 'v8',
}
module.exports = config

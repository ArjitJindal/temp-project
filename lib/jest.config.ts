import type { Config } from 'jest'

const config: Config = {
  testTimeout: 120000,
  preset: 'ts-jest',
  testMatch: ['<rootDir>/**/__tests__/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: false,
      },
    ],
  },
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/**/*.{ts}', '!**/node_modules/**'],
  coverageReporters: ['json-summary'],
}

module.exports = config

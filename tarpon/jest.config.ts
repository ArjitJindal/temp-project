module.exports = {
  testTimeout: 120000,
  preset: 'ts-jest',
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@lib/(.*)': '<rootDir>/lib/$1',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest-setup.ts'],
  globalTeardown: '<rootDir>/jest-teardown.ts',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
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
  collectCoverageFrom: [
    '<rootDir>/src/lambdas/**/*.ts',
    '<rootDir>/src/services/**/*.ts',
    '<rootDir>/src/utils/**/*.ts',
    '!<rootDir>/node_modules/**',
  ],
  coverageReporters: ['json-summary', 'text'],
  reporters: ['default', 'jest-junit'],
}

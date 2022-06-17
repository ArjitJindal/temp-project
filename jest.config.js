module.exports = {
  testTimeout: 15000,
  preset: 'ts-jest',
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@cdk/(.*)': '<rootDir>/lib/$1',
  },
  setupFiles: ['<rootDir>/jest-setup.ts'],
  globalTeardown: '<rootDir>/jest-teardown.ts',
}

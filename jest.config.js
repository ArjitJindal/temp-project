module.exports = {
  testTimeout: 60000,
  preset: 'ts-jest',
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@cdk/(.*)': '<rootDir>/lib/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest-setup.ts'],
}

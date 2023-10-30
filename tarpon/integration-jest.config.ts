module.exports = {
  testTimeout: 120000,
  preset: 'ts-jest',
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@lib/(.*)': '<rootDir>/lib/$1',
  },
  testMatch: ['<rootDir>/test-resources/**/__tests__/**/*.test.ts?(x)'],
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
}

import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';
import expectModule from 'expect';
import { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

const toBeColor: MatcherFunction<[color: string]> = function (actual: unknown, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') {
    throw new Error('Colors to compare should be strings');
  }
  const pass = expected.toLowerCase() === actual.toLowerCase();
  if (pass) {
    return {
      message: () =>
        // `this` context will have correct typings
        `expected ${this.utils.printReceived(
          actual,
        )} to be the same color ${this.utils.printExpected(expected)}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected ${this.utils.printReceived(
          actual,
        )} not to be the same color ${this.utils.printExpected(expected)}`,
      pass: false,
    };
  }
};

expect.extend({
  toBeColor,
});

declare module 'expect' {
  interface AsymmetricMatchers {
    toBeColor(expectedColor: string): void;
  }

  interface Matchers<R> extends TestingLibraryMatchers<typeof expectModule.stringContaining, R> {
    toBeColor(expectedColor: string): R;
  }
}

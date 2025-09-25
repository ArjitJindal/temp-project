import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';
import expectModule from 'expect';
import { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

export const toBeTruthyOrMessage: MatcherFunction<unknown[]> = function (isValid, message) {
  if (message == null) {
    throw new Error(`toBeTruthyOrMessage: message is required`);
  }
  if (typeof message !== 'string') {
    throw new Error(`toBeTruthyOrMessage: message should be a string`);
  }

  return {
    pass: !!isValid,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeTruthyOrMessage`,
          `${isValid}`,
          `"${message}"`,
        ),
        '',
        message,
      ].join('\n');
    },
  };
};

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
  toBeTruthyOrMessage,
});

declare module 'expect' {
  interface AsymmetricMatchers {
    toBeColor(expectedColor: string): void;
    toBeTruthyOrMessage(truthyValue: string): void;
  }

  interface Matchers<R> extends TestingLibraryMatchers<typeof expectModule.stringContaining, R> {
    toBeColor(expectedColor: string): R;
    toBeTruthyOrMessage(truthyValue: string): R;
  }
}

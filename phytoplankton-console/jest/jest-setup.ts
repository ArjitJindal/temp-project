import * as React from 'react';
import '@testing-library/jest-dom';
import './jest-matchers';
import '../src/@types/globals.d.ts';
import { beforeAll } from '@jest/globals';

global.React = React;

beforeAll(() => {
  global.matchMedia = () => {
    return {
      matches: false,
      media: '',
      addListener: () => {},
      removeListener: () => {},
      onchange: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {
        return false;
      },
    };
  };
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // do nothing
    }
    unobserve() {
      // do nothing
    }
    disconnect() {
      // do nothing
    }
  };
});

/*
  Disable warnings
 */
const originalWarn = console.warn.bind(console.warn);
const originalError = console.error.bind(console.error);
beforeAll(() => {
  const DISABLED_WARNINGS = [
    'ReactDOM.render is no longer supported in React 18', // https://www.notion.so/flagright/React-18-migrate-to-createRoot-API-2c67af3f941941728caf87f7a4cdd19a?pvs=4
  ];
  const catchDisabledWarnings = (f) => (msg) => {
    if (DISABLED_WARNINGS.some((w) => msg.toString().includes(w))) {
      return;
    }
    f(msg);
  };
  console.warn = catchDisabledWarnings(originalWarn);
  console.error = catchDisabledWarnings(originalError);
});
afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

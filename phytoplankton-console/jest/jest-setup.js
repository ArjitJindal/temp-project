import * as React from 'react';
import '@testing-library/jest-dom';
import { beforeAll } from '@jest/globals';

global.React = React;
global.MIXPANEL_TOKEN = undefined;
global.API_BASE_PATH = undefined;
global.AUTH0_AUDIENCE = undefined;
global.AUTH0_DOMAIN = undefined;
global.AUTH0_CLIENT_ID = undefined;
global.AUTH0_CLIENT_ID = undefined;
global.FEATURES_ENABLED = undefined;
global.EXPORT_ENTRIES_LIMIT = undefined;
global.SENTRY_DSN = undefined;
global.SLACK_CLIENT_ID = undefined;
global.IS_SENTRY_INSTANCE = undefined;

beforeAll(() => {
  global.matchMedia = () => {
    return {
      matches: false,
      media: '',
      addListener: () => {},
      removeListener: () => {},
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

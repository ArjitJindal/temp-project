import type { TestingLibraryMatchers } from '@types/testing-library__jest-dom/matchers';
import expectModule from 'expect';
import { Feature } from '@/apis';

declare global {
  declare const API_BASE_PATH: string | undefined;
  declare const AUTH0_AUDIENCE: string | undefined;
  declare const AUTH0_DOMAIN: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const FEATURES_ENABLED: Feature[];
  declare const EXPORT_ENTRIES_LIMIT: number;
  declare const SENTRY_DSN: string;
  declare const SLACK_CLIENT_ID: string;
  declare const HEAP_APP_ID: string;
}

// Patching Jest matcher types since we export 'expect' explicitly
declare module '@jest/expect' {
  export interface Matchers<R = void>
    extends TestingLibraryMatchers<typeof expectModule.stringContaining, R> {}
}

export {};

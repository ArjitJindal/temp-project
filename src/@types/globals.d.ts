import { AnalyticsBrowser } from '@segment/analytics-next';

declare global {
  declare const API_BASE_PATH: string;
  declare const AUTH0_AUDIENCE: string;
  declare const AUTH0_DOMAIN: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const EXPORT_ENTRIES_LIMIT: number;
  declare const SEGMENT_WRITE_KEY: string;

  interface Window {
    analytics: AnalyticsBrowser & {
      ready: (cb: () => void) => void;
    };
  }
}

export {};

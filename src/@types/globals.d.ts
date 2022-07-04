import { AnalyticsBrowser } from '@segment/analytics-next';
import { Feature } from '@/apis';

declare global {
  declare const API_BASE_PATH: string | undefined;
  declare const AUTH0_AUDIENCE: string | undefined;
  declare const AUTH0_DOMAIN: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const FEATURES_ENABLED: Feature[];
  declare const EXPORT_ENTRIES_LIMIT: number;
  declare const SEGMENT_WRITE_KEY: string;
  declare const SENTRY_DSN: string;

  interface Window {
    analytics: AnalyticsBrowser & {
      ready: (cb: () => void) => void;
    };
  }
}

export {};

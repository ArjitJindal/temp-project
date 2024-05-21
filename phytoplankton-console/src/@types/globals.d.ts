import { Feature } from '@/apis';

declare global {
  declare const API_BASE_PATH: string | undefined;
  declare const AUTH0_AUDIENCE: string | undefined;
  declare const AUTH0_DOMAIN: string;
  declare const AUTH0_CLIENT_ID: string;
  declare const FEATURES_ENABLED: Feature[];
  declare const EXPORT_ENTRIES_LIMIT: number;
  declare const SENTRY_DSN: string;
  declare const SLACK_CLIENT_ID: string;
  declare const HEAP_APP_ID: string;
  declare const POSTHOG_API_KEY: string;
  declare const POSTHOG_HOST: string;
}

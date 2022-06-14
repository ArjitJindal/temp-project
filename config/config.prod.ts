// https://umijs.org/config/
import { defineConfig } from 'umi';

export default defineConfig({
  define: {
    EXPORT_ENTRIES_LIMIT: 10000,
    API_BASE_PATH: undefined,
    AUTH0_AUDIENCE: undefined,
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: 'rfyoZTdxlqbFZ42DZ3lMVCnj3j9Onlki',
    SEGMENT_WRITE_KEY: 'eyTicOyPt6qFAO9p3t6vQ7hBGaFVixHJ',
  },
});

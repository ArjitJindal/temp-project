// https://umijs.org/config/
import { defineConfig } from 'umi';

export default defineConfig({
  define: {
    EXPORT_ENTRIES_LIMIT: 10000,
    API_BASE_PATH: 'http://localhost:3000',
    AUTH0_AUDIENCE: 'https://dev.api.flagright.com/',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    SEGMENT_WRITE_KEY: 'gBpbFMwyJQrf91g8zag3IrTOCnPfAiO5',
    FEATURES_ENABLED: {},
  },
});

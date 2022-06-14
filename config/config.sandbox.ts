import { defineConfig } from 'umi';

export default defineConfig({
  define: {
    EXPORT_ENTRIES_LIMIT: 10000,
    API_BASE_PATH: 'https://sandbox.api.flagright.com/console',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: 'dbinWZ63vFLquTEcbvg56o32HpVpuEJU',
    SEGMENT_WRITE_KEY: 'NK0nRddOM08d6gVVcB1vg8J0FHbatM95',
  },
});

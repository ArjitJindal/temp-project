import { defineConfig } from 'cypress';

const BASE_URL =
  process.env.ENV === 'local' ? 'https://flagright.local:8001/' : 'https://console.flagright.dev/';

export default defineConfig({
  env: {
    environment: process.env.ENV ?? 'local',
    loginUrl: 'https://login.console.flagright.dev/',
    auth0_domain: 'dev-flagright.eu.auth0.com',
    local_auth0_client_id: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    dev_auth0_client_id: 'uUFYLezaTSqQjj9052jiInDAaarI3f92',
    auth0_audience: 'https://api.flagright.dev/',
  },
  e2e: {
    defaultCommandTimeout: 15000,
    video: false,
    baseUrl: BASE_URL,
  },
  chromeWebSecurity: false,
  retries: 1,
});

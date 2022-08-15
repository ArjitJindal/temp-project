import { defineConfig } from 'cypress';

export default defineConfig({
  env: {
    loginUrl: 'https://login.dev.console.flagright.com/',
    auth0_domain: 'dev-flagright.eu.auth0.com',
    auth0_client_id: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    auth0_audience: 'https://dev.api.flagright.com/',
    // username: 'SHOULD_BE_PROVIDED_IN_ENV',
    // password: 'SHOULD_BE_PROVIDED_IN_ENV',
  },
  e2e: {
    video: false,
    baseUrl: 'https://dev.console.flagright.com/',
  },
});

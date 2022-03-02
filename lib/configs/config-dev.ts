import { Config } from './config';

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'us-east-2' },
  resource: {
    SITE_DOMAIN: 'dev.console.flagright.com',
  },
  application: {
    API_BASE_PATH: 'https://dev.api.flagright.com/console',
    AUTH0_AUDIENCE: 'https://dev.api.flagright.com/',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
  },
};

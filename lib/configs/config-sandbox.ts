import { Config } from './config';

export const config: Config = {
  stage: 'sandbox',
  env: { account: '293986822825', region: 'us-east-2' },
  resource: {
    SITE_DOMAIN: 'sandbox.console.flagright.com',
  },
  application: {
    API_BASE_PATH: 'https://sandbox.api.flagright.com/console',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_CLIENT_ID: '',
  },
};

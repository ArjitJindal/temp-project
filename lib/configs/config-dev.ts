import { Config } from './config'

export const config: Config = {
  stage: 'dev',
  env: { account: '911899431626', region: 'us-east-2' },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 1,
      WRITE_CAPACITY: 1,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
  },
  application: {
    AUTH0_AUDIENCE: 'https://dev.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://dev-flagright.eu.auth0.com/',
    AUTH0_JWKS_URI: 'https://dev-flagright.eu.auth0.com/.well-known/jwks.json',
  },
}

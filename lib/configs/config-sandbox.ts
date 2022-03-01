import { Config } from './config'

export const config: Config = {
  stage: 'sandbox',
  env: { account: '293986822825', region: 'us-east-2' },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 10,
      WRITE_CAPACITY: 5,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
  },
  application: {
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://sandbox-flagright.eu.auth0.com/',
    AUTH0_JWKS_URI:
      'https://sandbox-flagright.eu.auth0.com/.well-known/jwks.json',
  },
}

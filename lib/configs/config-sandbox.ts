import { Config } from './config'

const account = '293986822825'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'sandbox',
  env: { account: account, region: region },
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
      MEMORY_SIZE: 256,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
  },
  application: {
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://sandbox-flagright.eu.auth0.com/',
    AUTH0_JWKS_URI:
      'https://sandbox-flagright.eu.auth0.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'zJZSQU0P4P1XRwUR1p5QItFFmJQ9moul',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'z3U6yCyd08ge8Yk2VkQA8_H5u0-Q_xRyjVASOGoTh7axJB6z2jFIKDteTwA_J52f',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-suQQec`,
  },
}

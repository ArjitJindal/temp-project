import { Config } from './config'

const account = '911899431626'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'dev',
  env: { account: account, region: region },
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
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://dev.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://dev-flagright.eu.auth0.com/',
    AUTH0_JWKS_URI: 'https://dev-flagright.eu.auth0.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'O5XVh8xujWiL7Ij7gFCNbQdLrS5UPS6F',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'RrqgajkOImtw1ugT-32DiFzYsqMAMa7dwhiLhEJcQeSLnCkcR-GvYr1jLy9xv2U6',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-RvzMVI`,
  },
}

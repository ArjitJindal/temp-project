import { Config } from './config'

const account = '870721492449'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'prod',
  env: { account: account, region: region },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 10,
      WRITE_CAPACITY: 5,
    },
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 256,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 8,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 8,
      MEMORY_SIZE: 512,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 512,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 256,
    },
  },
  application: {
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://flagright.eu.auth0.com/',
    AUTH0_JWKS_URI: 'https://flagright.eu.auth0.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'gVL7LOtgnFfPMsRgZYRWWhpDk9SjAFZV',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'aJD1Dxa3cw9ZOrzbMPqbTzr-1lcyUGjQzrtSj1UpV1FDk7Qillpcr_l_h-R6PA0X',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-EUmRPl`,
  },
}

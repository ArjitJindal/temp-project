import { Config } from './config'

const account = '000000000000'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'local',
  env: { account: account, region: region },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 1,
      WRITE_CAPACITY: 1,
    },
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 128,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
  },
  application: {
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://dev.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://login.dev.console.flagright.com/',
    AUTH0_JWKS_URI:
      'https://login.dev.console.flagright.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'O5XVh8xujWiL7Ij7gFCNbQdLrS5UPS6F',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'RrqgajkOImtw1ugT-32DiFzYsqMAMa7dwhiLhEJcQeSLnCkcR-GvYr1jLy9xv2U6',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-RvzMVI`,
    CONSOLE_URI: 'https://dev.console.flagright.com',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    NODE_ENV: 'development',
    SLACK_CLIENT_ID: '2800969986821.3797458092182',
    SLACK_CLIENT_SECRET: 'b195cb611e873c4737863ce27e885d39',
    SLACK_REDIRECT_URI: 'https://${ngrok_url}/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
  },
}

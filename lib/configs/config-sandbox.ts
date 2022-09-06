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
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 256,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 512,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 512,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 512,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
  },
  application: {
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://login.sandbox.console.flagright.com/',
    AUTH0_JWKS_URI:
      'https://login.sandbox.console.flagright.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'zJZSQU0P4P1XRwUR1p5QItFFmJQ9moul',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'z3U6yCyd08ge8Yk2VkQA8_H5u0-Q_xRyjVASOGoTh7axJB6z2jFIKDteTwA_J52f',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-suQQec`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/N4Cd5cADBCU4WfihkQnvoYsq',
    CONSOLE_URI: 'https://sandbox.console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3789460302231',
    SLACK_CLIENT_SECRET: '012de08c805011ae63da0ab42cec420d',
    SLACK_REDIRECT_URI:
      'https://sandbox.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
  },
}

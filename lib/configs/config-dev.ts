import { Config } from './config'

const account = '911899431626'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'dev',
  env: { account, region },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 3,
      WRITE_CAPACITY: 1,
    },
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 256,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 512,
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
    CASE_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    BATCH_JOB_LAMBDA: {
      MEMORY_SIZE: 512,
    },
  },
  application: {
    CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:911899431626:certificate/18e81dca-c35a-453c-a566-9f2d9bfa0d98',
    AUTH0_CUSTOM_CNAME:
      'dev-flagright-cd-dc9lyrkmponfpoa2.edge.tenants.eu.auth0.com',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.dev/',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-RvzMVI`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-j8uTMO`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/b9EMVzubTbU3YRnn8tktYYnu',
    CONSOLE_URI: 'https://console.flagright.dev',
    SLACK_CLIENT_ID: '2800969986821.3797458092182',
    SLACK_CLIENT_SECRET: 'b195cb611e873c4737863ce27e885d39',
    SLACK_REDIRECT_URI:
      'https://api.flagright.dev/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    INTEGRATION_TEST_API_KEY_ID: 'sawiwhmtql',
  },
}

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Config } from './config'

const account = '293986822825'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'sandbox',
  env: { account, region },
  resource: {
    CLOUD_WATCH: {
      logRetention: RetentionDays.ONE_MONTH,
    },
    DYNAMODB: {
      BILLING_MODE: BillingMode.PAY_PER_REQUEST,
    },
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 512,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 512,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    CASE_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    BATCH_JOB_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    CRON_JOB_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    LAMBDA_VPC_ENABLED: true,
  },
  application: {
    CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:293986822825:certificate/a2e221d7-eaf5-42d5-ac39-1d500cbbd745',
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-suQQec`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-w67BQP`,
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '432dd5d0-d9ee-417e-90f3-647c4ce531ad',
    OPENAI_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:openAI-y7yGiu`,
    IBANCOM_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:ibanComCreds-2svAtq`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/N4Cd5cADBCU4WfihkQnvoYsq',
    CONSOLE_URI: 'https://sandbox.console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3789460302231',
    SLACK_CLIENT_SECRET: '012de08c805011ae63da0ab42cec420d',
    SLACK_REDIRECT_URI:
      'https://sandbox.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    INTEGRATION_TEST_API_KEY_ID: 'lvgtserzmf',
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    GOOGLE_SHEETS_PRIVATE_KEY: `arn:aws:secretsmanager:${region}:${account}:secret:GoogleSheetsPrivateKey-2N4ZGU`,
    API_USAGE_GOOGLE_SHEET_ID: '1sHbFc5uOMw5NGnRZMcVQBUwslwjrA9qpP3dUk_Shr3w',
    MERCHANT_MONITORING_SECRETS_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:MerchantMonitoring-Xwt8QJ`,
    FINCEN_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:fincenCreds-gCp9ut`,
  },
}

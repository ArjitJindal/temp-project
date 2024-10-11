import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { ADMIN_EMAILS } from '../constants/engineers'
import { Config } from './config'

const account = '293986822825'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'sandbox',
  env: { account, region },
  region: 'eu-1',
  budgets: {
    CLOUDWATCH: 200,
    DYNAMODB: 10,
    LAMBDA: 250,
    S3: 20,
    SQS: 10,
    EC2: 200,
    GUARDDUTY: 30,
    KINESIS: 40,
    SECRETS_MANAGER: 15,
    VPC: 20,
    EMR: 100,
    GLUE: 30,
  },
  resource: {
    FARGATE_BATCH_JOB_CONTAINER: {
      CPU: 2048,
      MEMORY_LIMIT: 4096,
    },
    CLOUD_WATCH: {
      logRetention: RetentionDays.TWO_WEEKS,
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
    ASYNC_RULES_LAMBDA: { MEMORY_SIZE: 1024 },
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: 10,
      MIN_PROVISIONED_CONCURRENCY: 0,
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 6,
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
      MEMORY_SIZE: 2048,
    },
    CRON_JOB_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    LAMBDA_VPC_ENABLED: true,
    INSPECTOR_ENABLED: false,
  },
  viper: {
    ADMIN_EMAILS: ADMIN_EMAILS,
    CREATE_METASTORE: false,
    CREATE_VPC: false,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Sandbox',
    MONGO_ATLAS_CLUSTER: 'Sandbox',
    AUTH0_DOMAIN: 'sandbox-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://sandbox.api.flagright.com/',
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '432dd5d0-d9ee-417e-90f3-647c4ce531ad',
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
    API_USAGE_GOOGLE_SHEET_ID: '1sHbFc5uOMw5NGnRZMcVQBUwslwjrA9qpP3dUk_Shr3w',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_API_KEY: 'phc_o3AIU7twnvMe1oXKZs8ZWYgVjVrI2BgJILpjvm0DWQY',
  },
}

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { ALL_ENGINEERS } from '../constants'
import { Config } from './config'

const account = '911899431626'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'dev',
  env: { account, region },
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
      CPU: 1024,
      MEMORY_LIMIT: 2048,
    },
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 512,
    },
    CLOUD_WATCH: {
      logRetention: RetentionDays.ONE_WEEK,
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
      PROVISIONED_CONCURRENCY: 0,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: 2,
      MIN_PROVISIONED_CONCURRENCY: 0,
      MEMORY_SIZE: 512,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {},
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 2,
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
      MEMORY_SIZE: 512,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
      MEMORY_SIZE: 1024,
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
      MEMORY_SIZE: 512,
    },
    BATCH_JOB_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    CRON_JOB_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    INSPECTOR_ENABLED: false,
    ATLAS_SEARCH_ENABLED: true,
  },
  clickhouse: {
    ipAccess: [{ source: '0.0.0.0/0', description: 'Allow all IP addresses' }],
  },
  viper: {
    ADMIN_EMAILS: ALL_ENGINEERS,
    CREATE_METASTORE: false,
    CREATE_VPC: true,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Dev',
    MONGO_ATLAS_CLUSTER: 'Dev-FRA',
    DEV_CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:911899431626:certificate/18e81dca-c35a-453c-a566-9f2d9bfa0d98',
    AUTH0_CUSTOM_CNAME:
      'dev-flagright-cd-dc9lyrkmponfpoa2.edge.tenants.eu.auth0.com',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.dev/',
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '432dd5d0-d9ee-417e-90f3-647c4ce531ad',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/b9EMVzubTbU3YRnn8tktYYnu',
    CONSOLE_URI: 'https://console.flagright.dev',
    SLACK_CLIENT_ID: '2800969986821.3797458092182',
    SLACK_CLIENT_SECRET: '7e47e8df70f4bfade8d8679b743bac67',
    SLACK_REDIRECT_URI:
      'https://api.flagright.dev/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    INTEGRATION_TEST_API_KEY_ID: 'hov2hklpll',
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '1JiK5HTWQVfNXO5XeoGheZTx9TwaHpDTQQUc2uNeH5Uw',
    POSTHOG_API_KEY: 'phc_12mxZXckh9t0LlosLIlraJl5xALKwOc8he1R6Jxwhus',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    MONGO_EVENT_TRIGGER_RULE_ID: '66d9d1170604e3825f395f1c',
  },
}

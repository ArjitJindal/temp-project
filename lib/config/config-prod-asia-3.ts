/**
 * Hong Kong
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { ADMIN_EMAILS } from '../constants'
import { Config, BillingMode, RetentionDays } from './config'

const account = '870721492449'
const region = 'ap-east-1'

export const config: Config = {
  stage: 'prod',
  region: 'asia-3',
  env: { account, region },
  budgets: {
    CLOUDWATCH: 150,
    DYNAMODB: 50,
    LAMBDA: 180,
    S3: 20,
    SQS: 10,
    EC2: 200,
    GUARDDUTY: 10,
    KINESIS: 70,
    SECRETS_MANAGER: 15,
    VPC: 20,
    EMR: 100,
    GLUE: 30,
  },
  resource: {
    FARGATE_BATCH_JOB_CONTAINER: {
      CPU: 2048,
      MEMORY_LIMIT: 4096,
      ARCHITECTURE: 'arm64',
    },
    CLOUD_WATCH: {
      logRetention: RetentionDays.ONE_YEAR,
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
      MAX_PROVISIONED_CONCURRENCY: 5,
      MIN_PROVISIONED_CONCURRENCY: 1,
      MEMORY_SIZE: 1024,
    },
    ASYNC_RULES_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 2,
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
      MEMORY_SIZE: 1024,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
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
    CLOUDWATCH_LOGS_INGESTION: {
      ENABLED: true,
      FIREHOSE_BUFFER_INTERVAL_SECONDS: 300,
      FIREHOSE_BUFFER_SIZE_MB: 5,
      LOG_GROUP_NAME: '/aws/lambda/tarponPublicApiTransactionFunction',
      FILTER_PATTERN: '[REPORT, RequestId, ..., duration=Duration*, ...]',
    },
    LAMBDA_VPC_ENABLED: true,
    INSPECTOR_ENABLED: false,
  },
  viper: {
    ADMIN_EMAILS: ADMIN_EMAILS,
    CREATE_METASTORE: true,
    CREATE_VPC: false,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Production',
    MONGO_ATLAS_CLUSTER: 'Prod-HKG',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    ZENDUTY_WEBHOOK_URL:
      'https://events.zenduty.com/integration/ro7ie/cloudwatch_v2/f90e82f4-d250-4237-94e6-a5f89cfe49f5/',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://me-1.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_API_KEY: 'phc_TjqVLBQelI3KfF61sd8iHiA9ThVmjG1k2vJYVcPgCbO',
  },
  opensearch: {
    deploy: false,
    dataNodes: 5,
    dataNodeInstanceType: 'm7g.large.search',
    volumeSize: 20,
  },
}

/**
 * Europe (Frankfurt)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { ADMIN_EMAILS } from '../constants'
import { Config, BillingMode, RetentionDays } from './config'

const account = '870721492449'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'prod',
  region: 'eu-1',
  env: { account, region },
  budgets: {
    CLOUDWATCH: 1300,
    DYNAMODB: 800,
    LAMBDA: 800,
    S3: 20,
    SQS: 40,
    EC2: 450,
    GUARDDUTY: 30,
    KINESIS: 70,
    SECRETS_MANAGER: 15,
    VPC: 40,
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
      MEMORY_SIZE: 1024,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: 32,
      MIN_PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 1024,
    },
    ASYNC_RULES_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 2048,
    },
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 2,
    USER_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 2048,
    },
    USER_AGGREGATION_MAX_CONCURRENCY: 2,
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 1024,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 2048,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    CASE_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 1024,
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
    INSPECTOR_ENABLED: true,
    DYNAMO_WRITE_CAPACITY_THRESHOLD: 470,
  },
  viper: {
    ADMIN_EMAILS: ADMIN_EMAILS,
    CREATE_METASTORE: true,
    CREATE_VPC: false,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Production',
    MONGO_ATLAS_CLUSTER: 'Prod-FRA',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    ZENDUTY_WEBHOOK_URL:
      'https://events.zenduty.com/integration/ro7ie/cloudwatch_v2/1fa45dcb-2f84-4ecb-a535-bb75cf054743/',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://eu-1.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_API_KEY: 'phc_TjqVLBQelI3KfF61sd8iHiA9ThVmjG1k2vJYVcPgCbO',
  },
  clickhouse: {
    awsPrivateLinkEndpointName:
      'com.amazonaws.vpce.eu-central-1.vpce-svc-09b4c3c24933d2ee2',
  },
  opensearch: {
    deploy: true,
    dataNodes: 7,
    dataNodeInstanceType: 'm7g.xlarge.search',
    volumeSize: 25,
  },
}

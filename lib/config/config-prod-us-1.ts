/**
 * US West (Oregon)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { ADMIN_EMAILS } from '../constants/engineers'
import { Config } from './config'

const account = '870721492449'
const region = 'us-west-2'

export const config: Config = {
  stage: 'prod',
  region: 'us-1',
  env: { account, region },
  budgets: {
    CLOUDWATCH: 200,
    DYNAMODB: 20,
    LAMBDA: 220,
    S3: 20,
    SQS: 10,
    EC2: 150,
    GUARDDUTY: 30,
    KINESIS: 65,
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
    INCOMING_WEBHOOK_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: 10,
      MIN_PROVISIONED_CONCURRENCY: 3,
      MEMORY_SIZE: 1024,
    },
    ASYNC_RULES_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 2,
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 1024,
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
    INSPECTOR_ENABLED: true,
  },
  viper: {
    ADMIN_EMAILS: ADMIN_EMAILS,
    CREATE_METASTORE: true,
    CREATE_VPC: false,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Production',
    MONGO_ATLAS_CLUSTER: 'Prod-PDX',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    ZENDUTY_WEBHOOK_URL:
      'https://events.zenduty.com/integration/ro7ie/cloudwatch_v2/2f2e21ca-e504-47f7-a24c-cb5aa1256afb/',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://us-1.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_API_KEY: 'phc_TjqVLBQelI3KfF61sd8iHiA9ThVmjG1k2vJYVcPgCbO',
    FINCEN_SFTP_IP: '164.95.10.142',
    FINCEN_SFTP_PORT: '2222',
  },
  clickhouse: {
    awsPrivateLinkEndpointName:
      'com.amazonaws.vpce.us-west-2.vpce-svc-03b4b1a843818b154',
  },
  opensearch: {
    availability: true,
    deploy: true,
  },
}

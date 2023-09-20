/**
 * Australia (Sydney)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Config } from './config'

const account = '870721492449'
const region = 'ap-southeast-2'

export const config: Config = {
  stage: 'prod',
  region: 'au-1',
  env: { account, region },
  resource: {
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
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 1024,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 1024,
    },
    HAMMERHEAD_CHANGE_CAPTURE_LAMBDA: {},
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
    LAMBDA_VPC_ENABLED: true,
  },
  application: {
    CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:870721492449:certificate/864c455d-197d-46ec-9f7f-361cb0d9c622',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-0pATd2`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-eN1ooL`,
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
    OPENAI_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:openAI-dpyirt`,
    IBANCOM_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:ibanComCreds-aOjsuy`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://uptime.betterstack.com/api/v1/aws-cloudwatch/webhook/A39U1zZKXm6Kp1kKiSN1bktU',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://au-1.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    API_USAGE_GOOGLE_SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    GOOGLE_SHEETS_PRIVATE_KEY: `arn:aws:secretsmanager:${region}:${account}:secret:GoogleSheetsPrivateKey-ME2RfO`,
    MERCHANT_MONITORING_SECRETS_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:MerchantMonitoring-WusYHh`,
  },
}

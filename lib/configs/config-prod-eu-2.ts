/**
 * Europe (London)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Config } from './config'

const account = '870721492449'
const region = 'eu-west-2'

export const config: Config = {
  stage: 'prod',
  region: 'eu-2',
  env: { account, region },
  resource: {
    DYNAMODB: {
      BILLING_MODE: BillingMode.PAY_PER_REQUEST,
    },
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 256,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 3,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 5,
      MEMORY_SIZE: 512,
    },
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 512,
    },
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 512,
    },
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2,
      MEMORY_SIZE: 256,
    },
    TARPON_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 512,
    },
    HAMMERHEAD_CHANGE_CAPTURE_LAMBDA: {
      MEMORY_SIZE: 512,
    },
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: 1,
      MEMORY_SIZE: 512,
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
    TARPON_CHANGE_CONSUMER_LAMBDA: {
      MEMORY_SIZE: 512,
    },
    LAMBDA_VPC_ENABLED: true,
  },
  application: {
    CERTIFICATE_ARN:
      'arn:aws:acm:eu-west-2:870721492449:certificate/7747fde3-4f1e-477a-aa83-850af6267ec5',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-3JQ3hd`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-EZFe7x`,
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
    OPENAI_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:openAI-dpyirt`,
    IBANCOM_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:ibanComCreds-VTLStT`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/4p86jybwUyKviVhw5SVXZGFV',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://eu-2.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    GOOGLE_SHEETS_PRIVATE_KEY: `arn:aws:secretsmanager:${region}:${account}:secret:GoogleSheetsPrivateKey-IPwC9a`,
  },
}

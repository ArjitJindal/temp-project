/**
 * Europe (Frankfurt)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { Config } from './config'

const account = '870721492449'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'prod',
  region: 'eu-1',
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
      PROVISIONED_CONCURRENCY: 24,
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
      MEMORY_SIZE: 256,
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
  },
  application: {
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://eu-1.api.flagright.com/',
    AUTH0_TOKEN_ISSUER: 'https://login.console.flagright.com/',
    AUTH0_JWKS_URI: 'https://login.console.flagright.com/.well-known/jwks.json',
    AUTH0_MANAGEMENT_CLIENT_ID: 'gVL7LOtgnFfPMsRgZYRWWhpDk9SjAFZV',
    AUTH0_MANAGEMENT_CLIENT_SECRET:
      'aJD1Dxa3cw9ZOrzbMPqbTzr-1lcyUGjQzrtSj1UpV1FDk7Qillpcr_l_h-R6PA0X',
    AUTH0_CONSOLE_CLIENT_ID: 'rfyoZTdxlqbFZ42DZ3lMVCnj3j9Onlki',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-EUmRPl`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-tBoLZm`,
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    BETTERUPTIME_HOOK_URL:
      'https://betteruptime.com/api/v1/aws-cloudwatch/webhook/4p86jybwUyKviVhw5SVXZGFV',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://eu-1.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
  },
}

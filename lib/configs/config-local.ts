import { Config } from './config'

const account = '911899431626'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'local',
  env: { account: account, region: region },
  resource: {
    DYNAMODB: {
      READ_CAPACITY: 1,
      WRITE_CAPACITY: 1,
    },
    PUBLIC_API_GATEWAY: {},
    CONSOLE_API_GATEWAY: {},
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: 128,
    },
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: 2, // 2 so we can have auto scaling
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
  },
  application: {
    CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:911899431626:certificate/18e81dca-c35a-453c-a566-9f2d9bfa0d98',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.dev/',
    ATLAS_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:mongoAtlasCreds-RvzMVI`,
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:complyAdvantageCreds-j8uTMO`,
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID:
      '432dd5d0-d9ee-417e-90f3-647c4ce531ad',
    CONSOLE_URI: 'https://console.flagright.dev',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    NODE_ENV: 'development',
    SLACK_CLIENT_ID: '2800969986821.3797458092182',
    SLACK_CLIENT_SECRET: 'b195cb611e873c4737863ce27e885d39',
    SLACK_REDIRECT_URI: 'https://${ngrok_url}/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    POSTMAN_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:PostmanAPICreds-iSFLI2`,
    POSTMAN_COLLECTION_ID: '24163049-503b80a7-dd73-4ed0-8aa6-5eaaa06f9ea5',
  },
}

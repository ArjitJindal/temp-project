import { Config, RetentionDays } from './config'

const account = '911899431626'
const region = 'eu-central-1'

export const config: Config = {
  stage: 'local',
  env: { account: account, region: region },
  budgets: {
    CLOUDWATCH: 0,
    DYNAMODB: 0,
    LAMBDA: 0,
    S3: 0,
    SQS: 0,
    EC2: 0,
    GUARDDUTY: 0,
    KINESIS: 0,
    SECRETS_MANAGER: 0,
    VPC: 0,
    EMR: 0,
    GLUE: 0,
  },
  resource: {
    FARGATE_BATCH_JOB_CONTAINER: {
      CPU: 1024,
      MEMORY_LIMIT: 2048,
      ARCHITECTURE: 'arm64',
    },
    CLOUD_WATCH: {
      logRetention: RetentionDays.TWO_WEEKS,
    },
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE: 512,
    },
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
      MAX_PROVISIONED_CONCURRENCY: 2, // 2 so we can have auto scaling
      MIN_PROVISIONED_CONCURRENCY: 0,
    },
    TRANSACTION_AGGREGATION_LAMBDA: {},
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: 2,
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
    INSPECTOR_ENABLED: false,
  },
  application: {
    DEV_CERTIFICATE_ARN:
      'arn:aws:acm:eu-central-1:911899431626:certificate/18e81dca-c35a-453c-a566-9f2d9bfa0d98',
    AUTH0_DOMAIN: 'dev-flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.dev/',
    CONSOLE_URI: 'https://console.flagright.dev',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    NODE_ENV: 'development',
    SLACK_CLIENT_ID: '2800969986821.3797458092182',
    SLACK_CLIENT_SECRET: 'b195cb611e873c4737863ce27e885d39',
    SLACK_REDIRECT_URI: 'https://${ngrok_url}/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    POSTMAN_SECRET_ARN: `arn:aws:secretsmanager:${region}:${account}:secret:PostmanAPICreds-iSFLI2`,
    POSTMAN_COLLECTION_ID: '25627167-9716caee-9579-4961-8254-66e40d894d09',
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '14VIlFKYsJq6R-UYAj-JVdAZA9PiBK5T7IgLzcFKRKlU',
  },
  opensearch: {
    deploy: true,
    dataNodes: 3,
    dataNodeInstanceType: '__local__',
    volumeSize: 10,
  },
}

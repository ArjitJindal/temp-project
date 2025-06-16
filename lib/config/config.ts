import { Duration, Environment } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { FlagrightRegion, Stage } from '../constants/deploy'

type ApiGatewayConfig = {
  CACHE?: {
    CAPACITY: '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237'
    TTL: Duration
  }
}

export type Config = {
  stage: Stage
  region?: FlagrightRegion
  env: Environment
  resource: {
    CLOUD_WATCH: {
      logRetention: RetentionDays
    }
    DYNAMO_WRITE_CAPACITY_THRESHOLD?: number
    FARGATE_BATCH_JOB_CONTAINER: {
      CPU: number
      MEMORY_LIMIT: number
    }
    DYNAMODB: {
      READ_CAPACITY?: number
      WRITE_CAPACITY?: number
      BILLING_MODE?: BillingMode
    }
    PUBLIC_API_GATEWAY: ApiGatewayConfig
    CONSOLE_API_GATEWAY: ApiGatewayConfig
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: number
    }
    BATCH_JOB_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    INCOMING_WEBHOOK_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    SANCTIONS_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    CRON_JOB_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    ASYNC_RULES_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    // Also used in sandbox for initial setup
    API_KEY_GENERATOR_LAMBDA?: {
      MEMORY_SIZE: number
    }
    // API Key authorizer result is cached for 3600 seconds
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    // JWT authorizer result is cached for 600 seconds
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: number
      MIN_PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE?: number
      PROVISIONED_CONCURRENCY?: number
    }
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: number
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE?: number
    }
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TARPON_CHANGE_CAPTURE_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    CASE_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    COPILOT_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    LAMBDA_VPC_ENABLED?: boolean
    INSPECTOR_ENABLED: boolean
    ATLAS_SEARCH_ENABLED?: boolean
    MONGO_DB_TRIGGER_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    DYNAMO_DB_TRIGGER_LAMBDA?: {
      MEMORY_SIZE?: number
    }
  }
  viper?: {
    ADMIN_EMAILS: string[]
    CREATE_METASTORE: boolean
    CREATE_VPC: boolean
  }
  budgets: {
    EC2: number
    S3: number
    LAMBDA: number
    DYNAMODB: number
    CLOUDWATCH: number
    SQS: number
    KINESIS: number
    VPC: number
    GUARDDUTY: number
    SECRETS_MANAGER: number
    EMR: number
    GLUE: number
  }
  clickhouse?: {
    awsPrivateLinkEndpointName?: string
    ipAccess?: { source: string; description: string }[]
    minTotalMemoryGb?: number
    maxTotalMemoryGb?: number
    numReplicas?: number
  }
  application: {
    MONGO_ATLAS_PROJECT?: string
    MONGO_ATLAS_CLUSTER?: string
    MONGO_EVENT_TRIGGER_RULE_ID?: string // We need to first generate the event trigger rule id and then paste it here
    DEV_CERTIFICATE_ARN?: string
    AUTH0_CUSTOM_CNAME?: string
    AUTH0_DOMAIN: string
    AUTH0_AUDIENCE: string
    COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID: string
    CONSOLE_URI: string
    MAXIMUM_ALLOWED_EXPORT_SIZE: number
    NODE_ENV?: string
    ZENDUTY_WEBHOOK_URL?: string
    POSTMAN_SECRET_ARN?: string
    SLACK_CLIENT_ID: string
    SLACK_CLIENT_SECRET: string
    SLACK_REDIRECT_URI: string
    WEBHOOK_REQUEST_TIMEOUT_SEC: number
    INTEGRATION_TEST_API_KEY_ID?: string
    POSTMAN_COLLECTION_ID?: string
    GOOGLE_SHEETS_CLIENT_EMAIL: string
    API_USAGE_GOOGLE_SHEET_ID: string
    POSTHOG_API_KEY?: string
    POSTHOG_HOST?: string
    FINCEN_SFTP_IP?: string
    FINCEN_SFTP_PORT?: string
  }
}

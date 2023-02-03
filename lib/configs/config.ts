import { Duration, Environment } from 'aws-cdk-lib'
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb'

type ApiGatewayConfig = {
  CACHE?: {
    CAPACITY: '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237'
    TTL: Duration
  }
}

export type Config = {
  stage: 'local' | 'dev' | 'sandbox' | 'prod'
  region?: 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  env: Environment
  resource: {
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
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TARPON_CHANGE_CAPTURE_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    HAMMERHEAD_CHANGE_CAPTURE_LAMBDA?: {
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
    LAMBDA_VPC_ENABLED?: boolean
  }
  application: {
    AUTH0_DOMAIN: string
    AUTH0_AUDIENCE: string
    AUTH0_TOKEN_ISSUER: string
    AUTH0_MANAGEMENT_API_AUDIENCE: string
    AUTH0_JWKS_URI: string
    AUTH0_CONSOLE_CLIENT_ID: string
    AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN: string
    ATLAS_CREDENTIALS_SECRET_ARN: string
    COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN: string
    CONSOLE_URI: string
    MAXIMUM_ALLOWED_EXPORT_SIZE: number
    NODE_ENV?: string
    BETTERUPTIME_HOOK_URL?: string
    POSTMAN_SECRET_ARN?: string
    SLACK_CLIENT_ID: string
    SLACK_CLIENT_SECRET: string
    SLACK_REDIRECT_URI: string
    WEBHOOK_REQUEST_TIMEOUT_SEC: number
    INTEGRATION_TEST_API_KEY_ID?: string
    POSTMAN_COLLECTION_ID?: string
  }
}

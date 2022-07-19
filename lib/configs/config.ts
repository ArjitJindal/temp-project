import { Environment } from 'aws-cdk-lib'

export type Config = {
  stage: 'local' | 'dev' | 'sandbox' | 'prod'
  env: Environment
  resource: {
    DYNAMODB: {
      READ_CAPACITY: number
      WRITE_CAPACITY: number
    }
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: number
    }
    API_KEY_AUTHORIZER_LAMBDA: {
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
    TRANSACTIONS_VIEW_LAMBDA?: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE: number
    }
  }
  application: {
    AUTH0_DOMAIN: string
    AUTH0_AUDIENCE: string
    AUTH0_TOKEN_ISSUER: string
    AUTH0_JWKS_URI: string
    AUTH0_MANAGEMENT_CLIENT_ID: string
    // TODO: Save/Retrieve secrets from AWS Secret Manager (Need to rotate the secrets after it's done)
    AUTH0_MANAGEMENT_CLIENT_SECRET: string
    ATLAS_CREDENTIALS_SECRET_ARN: string
    CONSOLE_URI: string
    MAXIMUM_ALLOWED_EXPORT_SIZE: number
    BETTERUPTIME_HOOK_URL?: string
    SLACK_CLIENT_ID: string
    SLACK_CLIENT_SECRET: string
    SLACK_REDIRECT_URI: string
  }
}

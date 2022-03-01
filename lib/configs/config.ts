import { Environment } from 'aws-cdk-lib'

export type Config = {
  stage: 'dev' | 'sandbox' | 'prod'
  env: Environment
  resource: {
    DYNAMODB: {
      READ_CAPACITY: number
      WRITE_CAPACITY: number
    }
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    TRANSACTION_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
  }
  application: {
    AUTH0_AUDIENCE: string
    AUTH0_TOKEN_ISSUER: string
    AUTH0_JWKS_URI: string
  }
}

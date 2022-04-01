import * as AWS from 'aws-sdk'

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  userId: string
  tenantName: string
}

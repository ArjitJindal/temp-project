import { S3 } from '@aws-sdk/client-s3'
import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { getCredentialsFromEvent } from './credentials'
import { envIs } from './env'
import { LOCAL_AWS_CONFIG } from '@/core/middlewares/local-dev'

export function getS3Client(credentials?: LambdaCredentials): S3 {
  return new S3(envIs('local') ? LOCAL_AWS_CONFIG : { credentials })
}

export function getS3ClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >
): S3 {
  return getS3Client(getCredentialsFromEvent(event))
}

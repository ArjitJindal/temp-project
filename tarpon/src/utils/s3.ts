import { S3 } from '@aws-sdk/client-s3'
import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { getCredentialsFromEvent } from './credentials'

export function getS3Client(credentials?: LambdaCredentials): S3 {
  if (process.env.ENV === 'local') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWSMock = require('mock-aws-s3')
    AWSMock.config.basePath = '/tmp/flagright/s3'
    return AWSMock.S3()
  }

  return new S3({
    credentials,
  })
}

export function getS3ClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >
): S3 {
  return getS3Client(getCredentialsFromEvent(event))
}

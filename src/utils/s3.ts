import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { getCredentialsFromEvent } from './credentials'

export function getS3Client(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): AWS.S3 {
  if (process.env.ENV === 'local') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWSMock = require('mock-aws-s3')
    AWSMock.config.basePath = '/tmp/flagright/s3'
    return AWSMock.S3()
  }

  return new AWS.S3({
    signatureVersion: 'v4',
    credentials: getCredentialsFromEvent(event),
  })
}

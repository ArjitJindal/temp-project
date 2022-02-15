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
  if (process.env.MOCK_S3 === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWSMock = require('mock-aws-s3')
    AWSMock.config.basePath = '/tmp/flagright/s3'
    return AWSMock.S3()
  }

  const isDevEnv = !process.env.NODE_ENV || process.env.NODE_ENV === 'dev'
  return new AWS.S3({
    credentials: isDevEnv
      ? new AWS.SharedIniFileCredentials()
      : getCredentialsFromEvent(event),
  })
}

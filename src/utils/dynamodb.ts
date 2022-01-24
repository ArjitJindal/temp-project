import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { getCredentialsFromEvent } from './credentials'

export function getDynamoDbClient(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): AWS.DynamoDB.DocumentClient {
  const isDevEnv = !process.env.NODE_ENV || process.env.NODE_ENV === 'dev'
  return new AWS.DynamoDB.DocumentClient({
    credentials: isDevEnv
      ? new AWS.SharedIniFileCredentials()
      : getCredentialsFromEvent(event),
    endpoint: isDevEnv ? 'http://localhost:8000' : undefined,
  })
}

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
  const isLocal = process.env.ENV === 'local'
  return new AWS.DynamoDB.DocumentClient({
    credentials: isLocal ? undefined : getCredentialsFromEvent(event),
    endpoint: isLocal
      ? process.env.DYNAMODB_URI || 'http://host.docker.internal:8000'
      : undefined,
  })
}

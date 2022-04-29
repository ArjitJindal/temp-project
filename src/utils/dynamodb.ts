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

export async function paginateQuery(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  pagesLimit?: number
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  return paginateQueryInternal(dynamoDb, query, 0, pagesLimit)
}

async function paginateQueryInternal(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  currentPage: number,
  pagesLimit = Infinity
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  const result = await dynamoDb.query(query).promise()
  if (result.LastEvaluatedKey && currentPage + 1 < pagesLimit) {
    const nextResult = await paginateQueryInternal(
      dynamoDb,
      {
        ...query,
        ExclusiveStartKey: result.LastEvaluatedKey,
      },
      currentPage + 1,
      pagesLimit
    )
    return {
      Items: result.Items?.concat(nextResult.Items || []),
      Count:
        result.Count &&
        result.Count + (nextResult.Count ? nextResult.Count : 0),
      ScannedCount:
        result.ScannedCount &&
        result.ScannedCount +
          (nextResult.ScannedCount ? nextResult.ScannedCount : 0),
    }
  }
  return result
}

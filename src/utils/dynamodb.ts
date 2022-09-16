import os from 'os'
import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import {
  ExpressionAttributeValueMap,
  UpdateExpression,
} from 'aws-sdk/clients/dynamodb'
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client'
import { chunk } from 'lodash'
import { StackConstants } from '@cdk/constants'
import { Credentials, CredentialsOptions } from 'aws-sdk/lib/credentials'
import { getCredentialsFromEvent } from './credentials'

export function getDynamoDbClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): AWS.DynamoDB.DocumentClient {
  const isLocal = process.env.ENV === 'local'
  return getDynamoDbClient(isLocal ? undefined : getCredentialsFromEvent(event))
}

export function getDynamoDbClient(
  credentials?: Credentials | CredentialsOptions
): AWS.DynamoDB.DocumentClient {
  const isLocal = process.env.ENV === 'local'
  return new AWS.DynamoDB.DocumentClient({
    credentials: isLocal
      ? {
          accessKeyId: 'fake',
          secretAccessKey: 'fake',
        }
      : credentials,
    region: isLocal ? 'local' : process.env.AWS_REGION,
    endpoint: isLocal
      ? process.env.DYNAMODB_URI ||
        `http://${
          os.type() === 'Linux' ? '172.17.0.1' : 'host.docker.internal'
        }:8000`
      : undefined,
  })
}

async function getLastEvaluatedKey(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  count = 0
): Promise<{ PartitionKeyID: string; SortKeyID: string } | undefined> {
  const newQuery = {
    ...query,
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }
  const result = await dynamoDb.query(newQuery).promise()

  if (
    result.LastEvaluatedKey &&
    query.Limit &&
    (result.Count as number) + count < query.Limit
  ) {
    return getLastEvaluatedKey(
      dynamoDb,
      {
        ...newQuery,
        ExclusiveStartKey: result.LastEvaluatedKey,
        Limit: (newQuery.Limit as number) - (result.Count as number),
      },
      result.Count as number
    )
  }
  return result.Items?.pop() as {
    PartitionKeyID: string
    SortKeyID: string
  }
}

export async function paginateQuery(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  options?: { skip?: number; limit?: number; pagesLimit?: number }
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  let newQuery = query
  if (options?.skip) {
    const skipQuery: AWS.DynamoDB.DocumentClient.QueryInput = {
      ...query,
      Limit: options.skip,
    }
    const lastEvaluatedKey = await getLastEvaluatedKey(dynamoDb, skipQuery)
    newQuery = {
      ...newQuery,
      ExclusiveStartKey: lastEvaluatedKey,
    }
  }
  if (options?.limit) {
    newQuery = {
      ...newQuery,
      Limit: options?.limit,
    }
  }
  return paginateQueryInternal(dynamoDb, newQuery, 0, {
    limit: options?.limit,
    pagesLimit: options?.pagesLimit,
  })
}

async function paginateQueryInternal(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  currentPage: number,
  options: { limit?: number; pagesLimit?: number }
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  const result = await dynamoDb.query(query).promise()
  const limit = query.Limit || options.limit
  const leftLimit = limit ? limit - (result.Count as number) : Infinity
  if (
    result.LastEvaluatedKey &&
    currentPage + 1 < (options.pagesLimit || Infinity) &&
    leftLimit > 0
  ) {
    const nextResult = await paginateQueryInternal(
      dynamoDb,
      {
        ...query,
        ExclusiveStartKey: result.LastEvaluatedKey,
        Limit: leftLimit,
      },
      currentPage + 1,
      { limit: leftLimit, pagesLimit: options.pagesLimit }
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
  delete result.LastEvaluatedKey
  return result
}

export async function* paginateQueryGenerator(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  pagesLimit = Infinity
): AsyncGenerator<AWS.DynamoDB.DocumentClient.QueryOutput> {
  let lastEvaluateKey = undefined
  let currentPage = 0

  while (lastEvaluateKey !== null && currentPage <= pagesLimit) {
    const paginatedQuery: AWS.DynamoDB.DocumentClient.QueryInput = {
      ...query,
      ExclusiveStartKey: lastEvaluateKey,
    }
    const result = await dynamoDb.query(paginatedQuery).promise()
    yield result
    lastEvaluateKey = result.LastEvaluatedKey || null
    currentPage += 1
  }
}

export async function batchWrite(
  dynamoDb: AWS.DynamoDB.DocumentClient,
  requests: DocumentClient.WriteRequest[],
  table: string = StackConstants.TARPON_DYNAMODB_TABLE_NAME
): Promise<void> {
  for (const nextChunk of chunk(requests, 25)) {
    await dynamoDb
      .batchWrite({
        RequestItems: {
          [table]: nextChunk,
        },
      })
      .promise()
  }
}

export function getUpdateAttributesUpdateItemInput(attributes: {
  [key: string]: any
}): {
  UpdateExpression: UpdateExpression
  ExpressionAttributeValues: ExpressionAttributeValueMap
} {
  const updateExpressions = []
  const expresssionValues: { [key: string]: any } = {}
  for (const key in attributes) {
    updateExpressions.push(`${key} = :${key}`)
    expresssionValues[`:${key}`] = attributes[key]
  }
  return {
    UpdateExpression: `SET ${updateExpressions.join(' ,')}`,
    ExpressionAttributeValues: expresssionValues,
  }
}

export type CursorPaginatedResponse<Item> = {
  items: Item[]
  cursor?: string
}

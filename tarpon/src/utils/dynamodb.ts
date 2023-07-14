import * as AWS from 'aws-sdk'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import {
  ExpressionAttributeValueMap,
  UpdateExpression,
} from 'aws-sdk/clients/dynamodb'
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client'
import _, { chunk } from 'lodash'
import { StackConstants } from '@lib/constants'
import { Credentials, CredentialsOptions } from 'aws-sdk/lib/credentials'
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { ConsumedCapacity, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import * as AWSXRay from 'aws-xray-sdk'
import { getCredentialsFromEvent } from './credentials'
import {
  DYNAMODB_READ_CAPACITY_METRIC,
  DYNAMODB_WRITE_CAPACITY_METRIC,
} from '@/core/cloudwatch/metrics'
import { logger } from '@/core/logger'
import { addNewSubsegment } from '@/core/xray'
import { getContext, publishMetric } from '@/core/utils/context'
import { envIs } from '@/utils/env'

function getAugmentedDynamoDBCommand(command: any): {
  type: 'READ' | 'WRITE' | null
  command: any
} {
  const newInput = {
    ...command.input,
    ReturnConsumedCapacity: 'TOTAL',
  }

  if (command instanceof PutCommand) {
    return { type: 'WRITE', command: new PutCommand(newInput) }
  } else if (command instanceof UpdateCommand) {
    return { type: 'WRITE', command: new UpdateCommand(newInput) }
  } else if (command instanceof DeleteCommand) {
    return { type: 'WRITE', command: new DeleteCommand(newInput) }
  } else if (command instanceof BatchWriteCommand) {
    return { type: 'WRITE', command: new BatchWriteCommand(newInput) }
  } else if (command instanceof QueryCommand) {
    return { type: 'READ', command: new QueryCommand(newInput) }
  } else if (command instanceof GetCommand) {
    return { type: 'READ', command: new GetCommand(newInput) }
  } else if (command instanceof BatchGetCommand) {
    return { type: 'READ', command: new BatchGetCommand(newInput) }
  }

  logger.warn(`Unhandled dynamodb command: ${command.constructor.name}`)
  return { type: null, command }
}

export function withMetrics(
  client: DynamoDBDocumentClient
): DynamoDBDocumentClient {
  client.send = _.wrap(
    client.send.bind(client),
    async (func: any, command: any, ...args) => {
      const commandInfo = getAugmentedDynamoDBCommand(command)
      const result = await func(commandInfo.command, ...args)
      const consumedCapacity = result?.ConsumedCapacity as ConsumedCapacity
      const capacityUnits = consumedCapacity?.CapacityUnits

      if (commandInfo.type === 'READ' && capacityUnits) {
        publishMetric(DYNAMODB_READ_CAPACITY_METRIC, capacityUnits, {
          table: command?.input?.TableName,
        })
      }
      if (commandInfo.type === 'WRITE' && capacityUnits) {
        publishMetric(DYNAMODB_WRITE_CAPACITY_METRIC, capacityUnits, {
          table: command?.input?.TableName,
        })
      }
      return result
    }
  ) as any
  return client
}

export function withRetry(
  client: DynamoDBDocumentClient
): DynamoDBDocumentClient {
  // We only retry with the refreshed credentials when running migrations
  if (!process.env.ASSUME_ROLE_ARN) {
    return client
  }

  client.send = _.wrap(
    client.send.bind(client),
    async (func: any, command: any, ...args) => {
      try {
        const result = await func(command, ...args)
        return result
      } catch (e) {
        if ((e as any)?.name === 'ExpiredTokenException') {
          logger.warn('Retry DynamoDB operation...')
          const retryClient = getDynamoDbClient(
            {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
              sessionToken: process.env.AWS_SESSION_TOKEN as string,
            },
            { retry: false }
          )
          return await retryClient.send(command, ...args)
        }
        throw e
      }
    }
  ) as any
  return client
}

export function getDynamoDbClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): DynamoDBDocumentClient {
  return getDynamoDbClient(
    envIs('local') ? undefined : getCredentialsFromEvent(event)
  )
}

export function getDynamoDbRawClient(
  credentials?: Credentials | CredentialsOptions
): DynamoDBClient {
  const isLocal = envIs('local')
  const rawClient = new DynamoDBClient({
    requestHandler: new NodeHttpHandler({
      socketTimeout: 10000, // this decreases the emfiles count, the Node.js default is 120000
    }),
    credentials: isLocal
      ? {
          accessKeyId: 'fake',
          secretAccessKey: 'fake',
        }
      : credentials,
    region: isLocal ? 'local' : process.env.AWS_REGION,
    endpoint: isLocal
      ? process.env.DYNAMODB_URI || 'http://localhost:8000'
      : undefined,
    maxAttempts: 6, // Default is 3
  })

  const context = getContext()
  if (context) {
    if (!context.dynamoDbClients) {
      context.dynamoDbClients = []
    }
    context.dynamoDbClients.push(rawClient)
  }

  return rawClient
}

type DynamoOption = (client: DynamoDBDocumentClient) => DynamoDBDocumentClient
export function getDynamoDbClient(
  credentials?: Credentials | CredentialsOptions,
  options?: { retry?: boolean; metrics?: boolean }
): DynamoDBDocumentClient {
  const rawClient = getDynamoDbRawClient(credentials)
  const client = !(envIs('local') || envIs('test'))
    ? AWSXRay.captureAWSv3Client(
        DynamoDBDocumentClient.from(rawClient, {
          marshallOptions: { removeUndefinedValues: true },
        })
      )
    : DynamoDBDocumentClient.from(rawClient, {
        marshallOptions: { removeUndefinedValues: true },
      })
  const { retry = !!process.env.ASSUME_ROLE_ARN, metrics = true } = {
    ...options,
  }

  const opts: DynamoOption[] = []
  if (retry) {
    opts.push(withRetry)
  }
  if (metrics) {
    opts.push(withMetrics)
  }
  return opts.reduce((client, opt) => opt(client), client)
}

async function getLastEvaluatedKey(
  dynamoDb: DynamoDBDocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  count = 0
): Promise<{ PartitionKeyID: string; SortKeyID: string } | undefined> {
  const newQuery = {
    ...query,
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }
  const result = await dynamoDb.send(new QueryCommand(newQuery))

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
  dynamoDb: DynamoDBDocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  options?: { skip?: number; limit?: number; pagesLimit?: number }
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  const ruleInfo = getContext()?.metricDimensions?.ruleId
    ? ` , ${getContext()?.metricDimensions?.ruleId} (${
        getContext()?.metricDimensions?.ruleInstanceId
      })`
    : undefined

  let paginateQuerySegment = undefined
  if (ruleInfo) {
    paginateQuerySegment = await addNewSubsegment(
      `DynamoDB${ruleInfo}`,
      'Paginate Query'
    )
  }
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
  const result = await paginateQueryInternal(dynamoDb, newQuery, 0, {
    limit: options?.limit,
    pagesLimit: options?.pagesLimit,
  })
  paginateQuerySegment?.close()
  return result
}

async function paginateQueryInternal(
  dynamoDb: DynamoDBDocumentClient,
  query: AWS.DynamoDB.DocumentClient.QueryInput,
  currentPage: number,
  options: { limit?: number; pagesLimit?: number }
): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
  const result = await dynamoDb.send(new QueryCommand(query))
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
  dynamoDb: DynamoDBDocumentClient,
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
    const result = await dynamoDb.send(new QueryCommand(paginatedQuery))
    yield result
    lastEvaluateKey = result.LastEvaluatedKey || null
    currentPage += 1
  }
}

export async function batchWrite(
  dynamoDb: DynamoDBDocumentClient,
  requests: DocumentClient.WriteRequest[],
  table: string = StackConstants.TARPON_DYNAMODB_TABLE_NAME
): Promise<void> {
  for (const nextChunk of chunk(requests, 25)) {
    await dynamoDb.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: nextChunk,
        },
      })
    )
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

export function dynamoDbQueryHelper(query: {
  tableName: string
  filterExpression?: string
  expressionAttributeNames?: AWS.DynamoDB.DocumentClient.ExpressionAttributeNameMap
  sortKey: {
    from: string
    to: string
  }
  expressionAttributeValues?: AWS.DynamoDB.DocumentClient.ExpressionAttributeValueMap
  partitionKey: string
  scanIndexForward?: boolean
  projectionExpression?: string
}): AWS.DynamoDB.DocumentClient.QueryInput {
  const {
    tableName,
    filterExpression,
    expressionAttributeNames,
    sortKey,
    partitionKey,
    scanIndexForward,
    projectionExpression,
    expressionAttributeValues,
  } = query

  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: tableName,
    ..._.omitBy(
      {
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ScanIndexForward: scanIndexForward,
        ProjectionExpression: projectionExpression,
      },
      _.isNil
    ),
  }

  if (sortKey.from === sortKey.to) {
    queryInput.KeyConditionExpression = `PartitionKeyID = :partitionKey AND SortKeyID = :sortKey`
    queryInput.ExpressionAttributeValues = {
      ':partitionKey': partitionKey,
      ':sortKey': sortKey.from,
      ...expressionAttributeValues,
    }
  } else {
    queryInput.KeyConditionExpression = `PartitionKeyID = :partitionKey AND SortKeyID BETWEEN :from AND :to`
    queryInput.ExpressionAttributeValues = {
      ':partitionKey': partitionKey,
      ':from': sortKey.from,
      ':to': sortKey.to,
      ...expressionAttributeValues,
    }
  }

  return queryInput
}

export type CursorPaginatedResponse<Item> = {
  items: Item[]
  cursor?: string
}

export function cleanUpDynamoDbResources() {
  const dynamoDbClients = getContext()?.dynamoDbClients
  if (dynamoDbClients) {
    dynamoDbClients.forEach((client) => {
      client.destroy()
    })
  }
}

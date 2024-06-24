import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { chunk, isNil, omitBy, wrap, omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  ConsumedCapacity,
  DynamoDBClient,
  AttributeValue,
  WriteRequest,
  PutRequest,
  DeleteRequest,
} from '@aws-sdk/client-dynamodb'
import { NativeAttributeValue } from '@aws-sdk/util-dynamodb'
import { StandardRetryStrategy } from '@smithy/middleware-retry'
import { getCredentialsFromEvent } from './credentials'
import { addNewSubsegment } from '@/core/xray'
import {
  DYNAMODB_READ_CAPACITY_METRIC,
  DYNAMODB_WRITE_CAPACITY_METRIC,
} from '@/core/cloudwatch/metrics'
import { logger } from '@/core/logger'
import { getContext, publishMetric } from '@/core/utils/context'
import { envIs, envIsNot } from '@/utils/env'

export const __dynamoDbClientsForTesting__: DynamoDBClient[] = []

export type PutRequestInternal = Omit<PutRequest, 'Item'> & {
  Item: Record<string, NativeAttributeValue> | undefined
}

export type DeleteRequestInternal = Omit<DeleteRequest, 'Key'> & {
  Key: Record<string, NativeAttributeValue> | undefined
}

export type BatchWriteRequestInternal = Record<
  string,
  Omit<WriteRequest, 'PutRequest' | 'DeleteRequest'> & {
    PutRequest?: PutRequestInternal
    DeleteRequest?: DeleteRequestInternal
  }
>

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
  client.send = wrap(
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
  let retryClient: DynamoDBDocumentClient | null = null

  const sendWithRetry = async (func: any, command: any, ...args) => {
    try {
      const result = await func(command, ...args)
      return result
    } catch (e) {
      if (
        (e as any)?.name === 'ExpiredTokenException' ||
        (envIs('test') && (e as any)?.name === 'TimeoutError')
      ) {
        logger.warn('Retry DynamoDB operation...')
        if (!retryClient) {
          retryClient = getDynamoDbClient(
            {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
              sessionToken: process.env.AWS_SESSION_TOKEN as string,
            },
            { retry: false }
          )
        }
        return await retryClient.send(command, ...args)
      }
      throw e
    }
  }

  // We only retry with the refreshed credentials when running migrations
  if (!process.env.ASSUME_ROLE_ARN) {
    return client
  }

  client.send = wrap(client.send.bind(client), sendWithRetry) as any
  return client
}
export function getDynamoDbClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >
): DynamoDBDocumentClient {
  return getDynamoDbClient(
    envIs('local', 'test') ? undefined : getCredentialsFromEvent(event)
  )
}

export function getDynamoDbRawClient(
  credentials?: LambdaCredentials
): DynamoDBClient {
  const isLocal = envIs('local', 'test')
  const rawClient = new DynamoDBClient({
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
    retryStrategy: new StandardRetryStrategy(async () => 15, {
      delayDecider: (delayBase: number, attempt: number) =>
        // NOTE: Exponential backoff with max delay as 1s
        // 100ms -> 200ms -> 400ms -> 800ms -> 1000ms -> 2000ms -> 2000ms
        Math.min(2000, delayBase * 2 ** attempt),
    }),
  })

  const context = getContext()
  if (context) {
    if (!context.dynamoDbClients) {
      context.dynamoDbClients = []
    }
    context.dynamoDbClients.push(rawClient)
  }

  if (envIs('test')) {
    __dynamoDbClientsForTesting__.push(rawClient)
  }

  return rawClient
}

type DynamoOption = (client: DynamoDBDocumentClient) => DynamoDBDocumentClient
export function getDynamoDbClient(
  credentials?: LambdaCredentials,
  options?: { retry?: boolean }
): DynamoDBDocumentClient {
  const rawClient = getDynamoDbRawClient(credentials)

  const client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  })

  const { retry = !!process.env.ASSUME_ROLE_ARN } = {
    ...options,
  }

  const opts: DynamoOption[] = []
  if (retry) {
    opts.push(withRetry)
  }
  if (envIsNot('test') && envIsNot('local')) {
    // TODO: Re-enable withMetrics in FR-4133
    // opts.push(withMetrics)
  }
  ;(client as any).__rawClient = rawClient
  return opts.reduce((client, opt) => opt(client), client)
}

async function getLastEvaluatedKey(
  dynamoDb: DynamoDBDocumentClient,
  query: QueryCommandInput,
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
  query: QueryCommandInput,
  options?: { skip?: number; limit?: number; pagesLimit?: number }
): Promise<QueryCommandOutput> {
  const ruleInfo = getContext()?.metricDimensions?.ruleId
    ? ` , ${getContext()?.metricDimensions?.ruleId} (${
        getContext()?.metricDimensions?.ruleInstanceId
      })`
    : undefined

  let paginateQuerySegment: any = undefined
  if (ruleInfo) {
    paginateQuerySegment = await addNewSubsegment(
      `DynamoDB${ruleInfo}`,
      'Paginate Query'
    )
  }
  let newQuery = query
  if (options?.skip) {
    const skipQuery: QueryCommandInput = {
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
  query: QueryCommandInput,
  currentPage: number,
  options: { limit?: number; pagesLimit?: number }
): Promise<QueryCommandOutput> {
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
      LastEvaluatedKey: nextResult.LastEvaluatedKey,
      $metadata: result.$metadata,
    }
  }
  delete result.LastEvaluatedKey
  return result
}

export async function* paginateQueryGenerator(
  dynamoDb: DynamoDBDocumentClient,
  query: QueryCommandInput,
  pagesLimit = Infinity
): AsyncGenerator<QueryCommandOutput> {
  let lastEvaluateKey: any = undefined
  let currentPage = 0

  while (lastEvaluateKey !== null && currentPage <= pagesLimit) {
    const paginatedQuery: QueryCommandInput = {
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
  requests: BatchWriteRequestInternal[],
  table: string = StackConstants.TARPON_DYNAMODB_TABLE_NAME
): Promise<void> {
  for (const nextChunk of chunk(requests, 25)) {
    try {
      await dynamoDb.send(
        new BatchWriteCommand({
          RequestItems: {
            [table]: nextChunk,
          },
        })
      )
    } catch (e) {
      if (
        (e as any)?.name === 'ValidationException' &&
        (e as any)?.message.includes(
          'Item size has exceeded the maximum allowed size'
        )
      ) {
        logger.error(`Item size has exceeded the maximum allowed size (400 KB)`)
      } else {
        throw e
      }
    }
  }
}

export function getUpdateAttributesUpdateItemInput(attributes: {
  [key: string]: any
}): {
  UpdateExpression: string
  ExpressionAttributeValues: Record<string, AttributeValue>
} {
  const updateExpressions: string[] = []
  const expresssionValues: { [key: string]: any } = {}
  for (const key in omit(attributes, ['PartitionKeyID', 'SortKeyID'])) {
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
  expressionAttributeNames?: Record<string, string>
  sortKey: {
    from: string
    to: string
  }
  expressionAttributeValues?: Record<
    string,
    QueryCommandInput['ExpressionAttributeValues']
  >
  partitionKey: string
  scanIndexForward?: boolean
  projectionExpression?: string
}): QueryCommandInput {
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

  const queryInput: QueryCommandInput = {
    TableName: tableName,
    ...omitBy(
      {
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ScanIndexForward: scanIndexForward,
        ProjectionExpression: projectionExpression,
      },
      isNil
    ),
  }

  // Make sure from <= to
  let from = sortKey.from
  if (from > sortKey.to) {
    from = sortKey.to
    logger.error(
      `'from' (${sortKey.from} should be less or equal to 'to' (${sortKey.to}) ) `
    )
  }

  queryInput.KeyConditionExpression = `PartitionKeyID = :partitionKey AND SortKeyID BETWEEN :from AND :to`
  queryInput.ExpressionAttributeValues = {
    ':partitionKey': partitionKey,
    ':from': from,
    ':to': sortKey.to,
    ...expressionAttributeValues,
  }

  return queryInput
}

export type CursorPaginatedResponse<Item> = {
  items: Item[]
  cursor?: string
}

export async function cleanUpDynamoDbResources() {
  try {
    const dynamoDbClients = getContext()?.dynamoDbClients
    if (dynamoDbClients && dynamoDbClients.length > 0) {
      const segment = await addNewSubsegment('DynamoDBClient', 'destroy')
      dynamoDbClients.forEach((client) => {
        client.destroy()
      })
      segment?.close()
    }
  } catch (e) {
    logger.error(`Failed to clean up dynamodb resources - ${e}`)
  }
}

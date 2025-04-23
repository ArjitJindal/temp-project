import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { chunk, isNil, omitBy, wrap, omit, uniqBy } from 'lodash'
import {
  BatchGetCommand,
  BatchGetCommandInput,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  ConsumedCapacity,
  DynamoDBClient,
  AttributeValue,
  WriteRequest,
  PutRequest,
  DeleteRequest,
  KeysAndAttributes,
  TransactWriteItem,
  Update,
  Delete,
  Put,
  ConditionCheck,
} from '@aws-sdk/client-dynamodb'
import { NativeAttributeValue } from '@aws-sdk/util-dynamodb'
import { ConfiguredRetryStrategy } from '@smithy/util-retry'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { getCredentialsFromEvent } from './credentials'
import { generateChecksum } from './object'
import { addNewSubsegment } from '@/core/xray'
import {
  DYNAMODB_READ_CAPACITY_METRIC,
  DYNAMODB_WRITE_CAPACITY_METRIC,
} from '@/core/cloudwatch/metrics'
import { logger } from '@/core/logger'
import { publishMetric } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { envIs, envIsNot } from '@/utils/env'

export const __dynamoDbClientsForTesting__: DynamoDBClient[] = []

export type PutRequestInternal = Omit<PutRequest, 'Item'> & {
  Item: Record<string, NativeAttributeValue> | undefined
}

export type DeleteRequestInternal = Omit<DeleteRequest, 'Key'> & {
  Key: Record<string, NativeAttributeValue> | undefined
}

export type BatchWriteRequestInternal = Omit<
  WriteRequest,
  'PutRequest' | 'DeleteRequest'
> & {
  PutRequest?: PutRequestInternal
  DeleteRequest?: DeleteRequestInternal
}

export type TransactWriteOperation = Omit<
  TransactWriteItem,
  'ConditionCheck' | 'Put' | 'Delete' | 'Update'
> & {
  ConditionCheck?: Omit<ConditionCheck, 'Key' | 'ExpressionAttributeValues'> & {
    Key: Record<string, NativeAttributeValue> | undefined
    ExpressionAttributeValues?: Record<string, NativeAttributeValue>
  }
  Put?: Omit<Put, 'Item' | 'ExpressionAttributeValues'> & {
    Item: Record<string, NativeAttributeValue> | undefined
    ExpressionAttributeValues?: Record<string, NativeAttributeValue>
  }
  Delete?: Omit<Delete, 'Key' | 'ExpressionAttributeValues'> & {
    Key: Record<string, NativeAttributeValue> | undefined
    ExpressionAttributeValues?: Record<string, NativeAttributeValue>
  }
  Update?: Omit<Update, 'Key' | 'ExpressionAttributeValues'> & {
    Key: Record<string, NativeAttributeValue> | undefined
    ExpressionAttributeValues?: Record<string, NativeAttributeValue>
  }
}

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

const MAX_SOCKETS = process.env.AWS_LAMBDA_FUNCTION_NAME ? 1000 : 60000
const CONNECTION_TIMEOUT = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? undefined
  : 30000
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
    retryStrategy: new ConfiguredRetryStrategy(
      async () => 15,
      // NOTE: Exponential backoff with max delay as 2s
      // delayBase = 100ms
      // 100ms -> 200ms -> 400ms -> 800ms -> 1000ms -> 2000ms -> 2000ms
      (attempt) => Math.min(2000, 100 * 2 ** attempt)
    ),
    requestHandler: new NodeHttpHandler({
      connectionTimeout: CONNECTION_TIMEOUT,
      httpAgent: { maxSockets: MAX_SOCKETS },
      httpsAgent: { maxSockets: MAX_SOCKETS },
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

export function getLocalDynamoDbClient(): DynamoDBDocumentClient {
  const rawClient = new DynamoDBClient({
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake',
    },
    region: 'local',
    endpoint: 'http://localhost:8000',
  })
  return DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  })
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
  const ruleId = getContext()?.metricDimensions?.ruleId
  const ruleInstanceId = getContext()?.metricDimensions?.ruleInstanceId
  const ruleInfo = ruleId ? ` , ${ruleId} (${ruleInstanceId})` : undefined

  let paginateQuerySegment: any = undefined
  // TODO: Remove "!ruleId?.startsWith('RC-')" in FR-5340
  if (ruleInfo && !ruleId?.startsWith('RC-')) {
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

const MAX_BATCH_WRITE_RETRY_COUNT = 20
const MAX_BATCH_WRITE_RETRY_DELAY = 10 * 1000
export async function batchWrite(
  dynamoDb: DynamoDBDocumentClient,
  requests: BatchWriteRequestInternal[],
  table: string
): Promise<void> {
  for (const nextChunk of chunk(requests, 25)) {
    try {
      let unProcessedItems: BatchWriteRequestInternal[] = nextChunk
      let retryCount = 0
      let retryDelay = 100
      while (unProcessedItems.length > 0) {
        const result = await dynamoDb.send(
          new BatchWriteCommand({
            RequestItems: {
              [table]: unProcessedItems,
            },
          })
        )
        unProcessedItems = result.UnprocessedItems?.[table] ?? []
        retryCount += 1
        if (
          unProcessedItems.length > 0 &&
          retryCount > MAX_BATCH_WRITE_RETRY_COUNT
        ) {
          throw new Error(
            `Failed to batch write items after ${MAX_BATCH_WRITE_RETRY_COUNT} retries (${unProcessedItems.length} items left)`
          )
        }
        if (unProcessedItems.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          retryDelay = Math.min(retryDelay * 2, MAX_BATCH_WRITE_RETRY_DELAY)
        }
      }
    } catch (e) {
      if (
        (e as any)?.name === 'ValidationException' &&
        (e as any)?.message.includes(
          'Item size has exceeded the maximum allowed size'
        )
      ) {
        // TODO: Remove this in FR-5806
        if (getContext()?.logMetadata?.ruleInstanceId) {
          logger.warn(
            `Item size has exceeded the maximum allowed size (400 KB)`
          )
        } else {
          logger.error(
            `Item size has exceeded the maximum allowed size (400 KB)`
          )
        }
      } else {
        throw e
      }
    }
  }
}

const MAX_BATCH_GET_RETRY_COUNT = 20
const MAX_BATCH_GET_RETRY_DELAY = 10 * 1000
export async function batchGet<T>(
  dynamoDb: DynamoDBDocumentClient,
  table: string,
  keys: Record<string, NativeAttributeValue>[],
  attributes: Omit<KeysAndAttributes, 'Keys'> = {}
): Promise<T[]> {
  const finalResult: T[] = []
  keys = uniqBy(keys, generateChecksum)
  for (const batchKeys of chunk(keys, 100)) {
    let retryDelay = 100
    let retryCount = 0
    let unprocessedKeys = batchKeys
    while (unprocessedKeys.length > 0) {
      const batchGetItemInput: BatchGetCommandInput = {
        RequestItems: {
          [table]: {
            Keys: unprocessedKeys,
            ...attributes,
          },
        },
      }
      const result = await dynamoDb.send(new BatchGetCommand(batchGetItemInput))
      const partialResult = result.Responses?.[table]
      retryCount += 1
      unprocessedKeys = result.UnprocessedKeys?.[table]?.Keys ?? []
      finalResult.push(...(partialResult as T[]))

      if (unprocessedKeys.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        retryDelay = Math.min(retryDelay * 2, MAX_BATCH_GET_RETRY_DELAY)
      }
      if (
        unprocessedKeys.length > 0 &&
        retryCount > MAX_BATCH_GET_RETRY_COUNT
      ) {
        throw new Error(
          `Failed to batch get items after ${MAX_BATCH_GET_RETRY_COUNT} retries (${unprocessedKeys.length} items left)`
        )
      }
    }
  }
  return finalResult.filter(Boolean)
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
  consistentRead?: boolean
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
    consistentRead = false,
  } = query

  const queryInput: QueryCommandInput = {
    TableName: tableName,
    ...omitBy(
      {
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ScanIndexForward: scanIndexForward,
        ProjectionExpression: projectionExpression,
        ConsistentRead: consistentRead,
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

type DynamoDbKey = {
  PartitionKeyID: string
  SortKeyID: string
}

export async function dangerouslyDeletePartition(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string,
  partitionKeyId: string,
  tableName: string,
  entityName?: string
) {
  const queryInput: QueryCommandInput = {
    TableName: tableName,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': partitionKeyId,
    },
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }

  await dangerouslyQueryPaginateDelete<DynamoDbKey>(
    dynamoDb,
    tenantId,
    queryInput,
    async (tenantId, item) => {
      await dangerouslyDeletePartitionKey(dynamoDb, item, tableName)
    }
  )
  logger.info(
    `Deleted  ${partitionKeyId}` + (entityName ? ` ${entityName}` : '')
  )
}
export async function dangerouslyQueryPaginateDelete<T>(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string,
  queryInput: QueryCommandInput,
  deleteMethod: (tenantId: string, item: T) => Promise<void>
) {
  for await (const result of paginateQueryGenerator(dynamoDb, queryInput)) {
    for (const item of (result.Items || []) as T[]) {
      try {
        await deleteMethod(tenantId, item)
      } catch (e) {
        logger.error(`Failed to delete item ${item} - ${e}`)
        throw e
      }
    }
  }
}
export async function dangerouslyDeletePartitionKey(
  dynamoDb: DynamoDBDocumentClient,
  key: DynamoDbKey,
  tableName: string
) {
  const deleteCommand = new DeleteCommand({ TableName: tableName, Key: key })
  await dynamoDb.send(deleteCommand)
}

/**
 * Recursively converts MongoDB ObjectIds to strings in an object structure
 *
 * Did not want to use marshalling/unmarshalling because it might break the object structure
 */
export function sanitizeMongoObject<T>(obj: T): T {
  if (!obj) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoObject) as unknown as T
  }

  if (typeof obj === 'object') {
    if (
      obj.constructor.name === 'ObjectID' ||
      (obj as any)?._bsontype === 'ObjectID'
    ) {
      return obj?.toString() as unknown as T
    }

    const result: Record<string, any> = {}

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue
      }

      if (key === '_id') {
        result[key] = obj[key]?.toString()
      } else {
        result[key] = sanitizeMongoObject(obj[key])
      }
    }

    return result as unknown as T
  }

  return obj
}

const MAX_TRANSACT_WRITE_RETRY_COUNT = 10
const MAX_TRANSACT_WRITE_RETRY_DELAY = 5 * 1000

export async function transactWrite(
  dynamoDb: DynamoDBDocumentClient,
  operations: TransactWriteOperation[]
): Promise<void> {
  for (const nextChunk of chunk(operations, 100)) {
    let retryCount = 0
    let retryDelay = 100
    let success = false

    while (!success) {
      try {
        await dynamoDb.send(
          new TransactWriteCommand({
            TransactItems: nextChunk as TransactWriteItem[],
          })
        )
        success = true
      } catch (e) {
        retryCount += 1

        if (
          (e as any)?.name === 'TransactionCanceledException' &&
          retryCount <= MAX_TRANSACT_WRITE_RETRY_COUNT
        ) {
          logger.warn(
            `TransactWrite retry ${retryCount}/${MAX_TRANSACT_WRITE_RETRY_COUNT}`
          )
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          retryDelay = Math.min(retryDelay * 2, MAX_TRANSACT_WRITE_RETRY_DELAY)
        } else if (
          (e as any)?.name === 'ValidationException' &&
          (e as any)?.message.includes(
            'Item size has exceeded the maximum allowed size'
          )
        ) {
          if (getContext()?.logMetadata?.ruleInstanceId) {
            logger.warn(
              `Item size has exceeded the maximum allowed size (400 KB)`
            )
          } else {
            logger.error(
              `Item size has exceeded the maximum allowed size (400 KB)`
            )
          }
          success = true
        } else {
          throw e
        }
      }
    }
  }
}

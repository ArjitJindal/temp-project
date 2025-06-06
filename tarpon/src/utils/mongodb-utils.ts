import { StackConstants } from '@lib/constants'
import {
  AggregationCursor,
  ClientSession,
  Collection,
  Db,
  Document,
  Filter,
  FindCursor,
  FindOptions,
  ModifyResult,
  MongoClient,
  ObjectId,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOneModel,
  UpdateResult,
  WithId,
} from 'mongodb'

import { isEqual, memoize } from 'lodash'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { escapeStringRegexp } from './regex'
import { getSecretByName } from './secrets-manager'
import {
  getGlobalCollectionIndexes,
  getMongoDbIndexDefinitions,
  getSearchIndexName,
} from './mongodb-definitions'
import {
  sendBulkMessagesToMongoConsumer,
  sendMessageToMongoConsumer,
} from './clickhouse/utils'
import { envIs, envIsNot } from './env'
import { isDemoTenant } from './tenant'
import { getSQSClient } from './sns-sqs-client'
import { generateChecksum } from './object'
import { MONGO_TEST_DB_NAME } from '@/test-utils/mongo-test-utils'
import {
  DEFAULT_PAGE_SIZE,
  getPageSizeNumber,
  MAX_PAGE_SIZE,
  OptionalPaginationParams,
  PageSize,
} from '@/utils/pagination'
import {
  HOUR_DATE_FORMAT,
  DAY_DATE_FORMAT,
  MONTH_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  DAY_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
import { logger } from '@/core/logger'
import { CounterRepository } from '@/services/counter/repository'
import { hasFeature } from '@/core/utils/context'
import { executeMongoUpdate } from '@/lambdas/mongo-update-consumer/app'
const getMongoDbClientInternal = memoize(async (useCache = true) => {
  if (process.env.NODE_ENV === 'test') {
    return await MongoClient.connect(
      process.env.MONGO_URI ||
        `mongodb://localhost:27018/${MONGO_TEST_DB_NAME}?directConnection=true`
    )
  }
  if (process.env.ENV?.includes('local')) {
    return await MongoClient.connect(
      `mongodb://localhost:27018/${StackConstants.MONGO_DB_DATABASE_NAME}?directConnection=true`
    )
  }
  const credentials = await getSecretByName('mongoAtlasCreds', useCache)
  const DB_USERNAME = credentials['username']
  const DB_PASSWORD = encodeURIComponent(credentials['password'])
  const DB_HOST = credentials['host']
  const DB_URL = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}/${StackConstants.MONGO_DB_DATABASE_NAME}`
  return await MongoClient.connect(DB_URL as string)
})

export async function getMongoDbClient(useCache = true) {
  if (!useCache) {
    getMongoDbClientInternal.cache.clear?.()
  }
  return await getMongoDbClientInternal(useCache)
}

export async function getMongoDbClientDb(useCache = true) {
  return (await getMongoDbClient(useCache)).db()
}

export function success(body: object): object {
  return buildResponse(200, body)
}

export function failure(body: object): object {
  return buildResponse(500, body)
}

export function notFound(body: object): object {
  return buildResponse(404, body)
}

function buildResponse(statusCode: number, body: object): object {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  }
}

export function getDateFormatByGranularity(
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  if (granularity === 'HOUR') {
    return HOUR_DATE_FORMAT
  } else if (granularity === 'DAY') {
    return DAY_DATE_FORMAT
  } else if (granularity === 'MONTH') {
    return MONTH_DATE_FORMAT
  }
}

export function getDateFormatJsByGranularity(
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  if (granularity === 'HOUR') {
    return HOUR_DATE_FORMAT_JS
  } else if (granularity === 'DAY') {
    return DAY_DATE_FORMAT_JS
  } else if (granularity === 'MONTH') {
    return MONTH_DATE_FORMAT_JS
  }
}

/*
  Pagination
 */
export function getSkipAndLimit<Params extends OptionalPaginationParams>(
  params: Params
): {
  limit: number
  skip: number
} {
  if (params.pageSize === 'DISABLED') {
    return {
      limit: Number.MAX_SAFE_INTEGER,
      skip: 0,
    }
  }

  let pageSize: PageSize | 'DISABLED' = DEFAULT_PAGE_SIZE
  let page = 1

  if ('pageSize' in params) {
    const pageSizeParam = params['pageSize']
    if (typeof pageSizeParam === 'number') {
      pageSize = pageSizeParam
    } else if (typeof pageSizeParam === 'string') {
      pageSize =
        pageSizeParam === 'DISABLED'
          ? 'DISABLED'
          : Math.max(
              1,
              Math.min(
                parseInt(pageSizeParam) || DEFAULT_PAGE_SIZE,
                MAX_PAGE_SIZE
              )
            )
    }
  }
  if (typeof params['page'] === 'number') {
    page = Math.max(1, params['page'])
  } else if (typeof params['page'] === 'string') {
    page = Math.max(1, parseInt(params['page']) || 1)
  }

  const pageSizeAsNumber = getPageSizeNumber(pageSize)

  return {
    limit: pageSizeAsNumber,
    skip: (page - 1) * pageSizeAsNumber,
  }
}

export function paginateFindOptions<Params extends OptionalPaginationParams>(
  params: Params
): FindOptions {
  if (params.pageSize === 'DISABLED') {
    return {}
  }
  const { skip, limit } = getSkipAndLimit(params)
  return {
    skip,
    limit,
  }
}

type lookupPipelineStageStage = {
  from: string
  localField: string
  foreignField: string
  as: string
  pipeline?: Document[]
  _let?: Document
}

export function lookupPipelineStage(
  params: lookupPipelineStageStage,
  disablePipeline = false
): Document {
  return {
    $lookup: {
      from: params.from,
      localField: params.localField,
      foreignField: params.foreignField,
      as: params.as,
      ...(params._let ? { let: params._let } : {}),
      ...(!disablePipeline
        ? {
            pipeline: [
              {
                $match: {
                  [params.foreignField]: {
                    $exists: true,
                    $nin: [null, undefined],
                  },
                },
              },
              ...(params.pipeline || []),
            ],
          }
        : {}),
    },
  }
}

export function paginateCursor<
  Params extends OptionalPaginationParams,
  TSchema
>(
  cursor: FindCursor<WithId<TSchema>>,
  params: Params
): FindCursor<WithId<TSchema>> {
  if (params.pageSize === 'DISABLED') {
    return cursor
  }
  const { skip, limit } = getSkipAndLimit(params)
  return cursor.skip(skip).limit(limit)
}

export function paginatePipeline<Params extends OptionalPaginationParams>(
  params: Params
): Document[] {
  if (params.pageSize === 'DISABLED') {
    return []
  }
  const { skip, limit } = getSkipAndLimit(params)
  return [{ $skip: skip }, { $limit: limit }]
}

/**
 * Matching utils
 */

// This should be the default regex filter to use for performance concerns
// Ref: https://www.mongodb.com/docs/manual/reference/operator/query/regex/#index-use
export function prefixRegexMatchFilter(input: string, caseInsensitive = false) {
  return {
    $regex: `^${escapeStringRegexp(input)}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export function prefixRegexMatchFilterForArray(
  input: string[],
  caseInsensitive = false
) {
  return {
    $regex: `^${input.map((i) => escapeStringRegexp(i)).join('|')}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export function regexMatchFilterForArray(
  input: string[],
  caseInsensitive = false
) {
  return {
    $regex: `${input.map((i) => escapeStringRegexp(i)).join('|')}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export function regexMatchFilter(input: string, caseInsensitive = false) {
  return {
    $regex: `${escapeStringRegexp(input)}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export async function createCollectionIfNotExist(
  db: Db,
  collectionName: string
): Promise<Collection> {
  try {
    return await db.createCollection(collectionName)
  } catch (e) {
    // ignore already exists
    return db.collection(collectionName)
  }
}

export const createMongoDBCollections = async (
  mongoClient: MongoClient,
  tenantId: string
) => {
  const indexDefinitions = getMongoDbIndexDefinitions(tenantId)
  await createMongoDBCollectionsInternal(
    mongoClient,
    indexDefinitions,
    tenantId
  )
  await new CounterRepository(tenantId, mongoClient).initialize()
}

export const createGlobalMongoDBCollections = async (
  mongoClient: MongoClient
) => {
  const indexDefinitions = await getGlobalCollectionIndexes(mongoClient)
  await createMongoDBCollectionsInternal(mongoClient, indexDefinitions)
}

const shouldBuildSearchIndex = (tenantId?: string) => {
  return (
    envIsNot('test') &&
    (!tenantId || (!isDemoTenant(tenantId) && hasFeature('DOW_JONES')))
  )
}

const createMongoDBCollectionsInternal = async (
  mongoClient: MongoClient,
  indexDefinitions: {
    [collectionName: string]: {
      getIndexes: () => Array<{
        index: {
          [key: string]: any
        }
        unique?: boolean
      }>
      getSearchIndex?: () => Document
    }
  },
  tenantId?: string
) => {
  const db = mongoClient.db()
  for (const collectionName in indexDefinitions) {
    const collection = await createCollectionIfNotExist(db, collectionName)
    const definition = indexDefinitions[collectionName]
    await syncIndexes(collection, definition.getIndexes())
    if (definition.getSearchIndex) {
      if (shouldBuildSearchIndex(tenantId)) {
        await createSearchIndex(
          db,
          collectionName,
          definition.getSearchIndex(),
          getSearchIndexName(collectionName)
        )
      }
    }
  }
}

async function createSearchIndex(
  db: Db,
  collectionName: string,
  definition: Document,
  indexName: string
) {
  const collection = db.collection(collectionName)
  if (
    (await db.listCollections({ name: collectionName }).toArray()).length > 0
  ) {
    await createIndex(collection, indexName, definition)
  }
}

async function createIndex(
  collection: Collection,
  index: string,
  definition: Document
) {
  const indexes = await collection.listSearchIndexes().toArray()
  const indexesToDrop = indexes.filter((i) => i.name !== index)
  for (const indexToDrop of indexesToDrop) {
    await deleteIndex(collection, indexToDrop.name)
    logger.info(`Dropped search index for ${indexToDrop.name}`)
  }

  if (indexes.find((i) => i.name === index)) {
    await collection.updateSearchIndex(index, definition)
    logger.info(`Updated search index for ${index}`)
  } else {
    await collection.createSearchIndex({
      name: index,
      definition: definition,
    })
    logger.info(`Created search index for ${index}`)
  }
}

async function deleteIndex(collection: Collection, index: string) {
  const indexes = await collection.listSearchIndexes().toArray()
  if (indexes.find((i) => i.name === index)) {
    await collection.dropSearchIndex(index)
    logger.info(`Dropped search index for ${index}`)
  }
}

export async function allCollections(tenantId: string, db: Db) {
  const re = new RegExp(`^${escapeStringRegexp(tenantId)}(-test)?-`)
  const collections = await db
    .listCollections({
      name: re,
    })
    .toArray()

  return collections.map((c) => c.name)
}

export async function syncIndexes<T>(
  collection: Collection<T extends Document ? T : Document>,
  indexes: { index: Document; unique?: boolean }[]
) {
  const currentIndexes = await collection.indexes()
  let currentTotalIndexes = currentIndexes.length
  const indexesToCreate = indexes.filter(
    (desired) =>
      !currentIndexes.find((current) => isEqual(desired.index, current.key))
  )
  const indexesToDrop = currentIndexes.filter(
    (index) =>
      index.name !== '_id_' &&
      !indexes.find((desired) => isEqual(desired.index, index.key))
  )

  if (indexesToCreate.length > 64) {
    throw new Error("Can't create more than 64 indexes")
  }
  // Do "Blue-Green" index creation if possible:
  // - create new indexes until we cannot (64 limit)
  // - only drop old indexes when we must to (64 limit reached) or when the new indexes are
  //   already created
  while (indexesToDrop.length > 0 || indexesToCreate.length > 0) {
    if (currentTotalIndexes === 64 || indexesToCreate.length === 0) {
      const indexToDrop = indexesToDrop.pop()
      if (indexToDrop) {
        await collection.dropIndex(indexToDrop.name)
        logger.info(
          `Dropped index - ${indexToDrop.name} (${collection.collectionName})`
        )
        currentTotalIndexes -= 1
      }
    } else {
      const indexToCreate = indexesToCreate.pop()
      if (indexToCreate) {
        await collection.createIndex(indexToCreate.index, {
          unique: indexToCreate.unique ?? false,
          background: true,
        })
        logger.info(
          `Created index - ${JSON.stringify(indexToCreate)} (${
            collection.collectionName
          })`
        )
        currentTotalIndexes += 1
      }
    }
  }
}

export const withTransaction = async <T = void>(
  callback: (session: ClientSession) => Promise<T>
): Promise<T> => {
  const mongoDb = await getMongoDbClient()
  const session = mongoDb.startSession()

  session.startTransaction()
  try {
    const result = await callback(session)
    await session.commitTransaction()
    return result
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
}

export async function processCursorInBatch<T>(
  entityCursor: FindCursor<WithId<T>> | AggregationCursor<T>,
  processBatch: (batch: (T | WithId<T>)[]) => Promise<void>,
  options?: {
    mongoBatchSize?: number
    processBatchSize?: number
    debug?: boolean
  }
): Promise<void> {
  const mongoBatchSize = options?.mongoBatchSize ?? 1000
  const processBatchSize = options?.processBatchSize ?? 1000
  const debug = options?.debug ?? false
  const cursor = entityCursor.batchSize(mongoBatchSize)
  let pendingEntities: (T | WithId<T>)[] = []
  let i = 0
  for await (const entity of cursor) {
    pendingEntities.push(entity)
    if (pendingEntities.length === processBatchSize) {
      await processBatch(pendingEntities)
      i++
      pendingEntities = []
      if (debug) {
        logger.warn(
          `Processed batch #${i}, ${i * processBatchSize} entities processed`
        )
      }
    }
  }
  if (pendingEntities.length > 0) {
    await processBatch(pendingEntities)
    i++
  }
  if (debug) {
    logger.warn(
      `Processed batch #${i}, ${i * processBatchSize} entities processed`
    )
  }
}

export async function internalMongoReplace<T extends Document>(
  mongoClient: MongoClient,
  collectionName: string,
  filter: Filter<T>,
  replacement: T
): Promise<{ _id: ObjectId }> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  const data = await collection.findOneAndReplace(filter, replacement, {
    returnDocument: 'after',
    upsert: true,
    projection: { _id: 1 },
  })

  const result = data.value as { _id: ObjectId }
  await sendMessageToMongoConsumer({
    collectionName,
    documentKey: { type: 'id', value: String(result._id) },
    operationType: 'replace',
    clusterTime: Date.now(),
  })

  return result
}

export async function internalMongoUpdateOne<T extends Document>(
  mongoClient: MongoClient,
  collectionName: string,
  filter: Filter<T>,
  update: Document,
  options?: {
    arrayFilters?: Document[]
    returnFullDocument?: boolean
    session?: ClientSession
    upsert?: boolean
  }
): Promise<ModifyResult<T>> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  const data = await collection.findOneAndUpdate(filter, update, {
    returnDocument: 'after',
    upsert: options?.upsert ?? true,
    ...(options?.arrayFilters ? { arrayFilters: options.arrayFilters } : {}),
    ...(options?.returnFullDocument ? {} : { projection: { _id: 1 } }),
    ...(options?.session ? { session: options.session } : {}),
  })

  const result = data.value

  // Assuming that update didn't changed anything, we can return the original data
  if (!result?._id) {
    return data
  }

  await sendMessageToMongoConsumer({
    collectionName,
    documentKey: { type: 'id', value: String(result._id) },
    operationType: 'update',
    clusterTime: Date.now(),
  })

  return data
}

export async function internalMongoUpdateMany<T extends Document = Document>(
  mongoClient: MongoClient,
  collectionName: string,
  filter: Filter<T>,
  update: Document,
  options?: { arrayFilters?: Document[] }
): Promise<UpdateResult<T>> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  const result = await collection.updateMany(filter, update, options)

  await sendMessageToMongoConsumer({
    collectionName,
    documentKey: { type: 'filter', value: filter as Filter<Document> },
    operationType: 'update',
    clusterTime: Date.now(),
  })

  return result
}

export async function internalMongoDeleteOne<T extends Document>(
  mongoClient: MongoClient,
  collectionName: string,
  filter: Filter<T>
): Promise<void> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  await collection.deleteOne(filter)

  await sendMessageToMongoConsumer({
    collectionName,
    documentKey: { type: 'filter', value: filter as Filter<Document> },
    operationType: 'delete',
    clusterTime: Date.now(),
  })
}

export async function internalMongoInsert<T extends Document>(
  mongoClient: MongoClient,
  collectionName: string,
  document: OptionalUnlessRequiredId<T>
): Promise<void> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  const result = await collection.insertOne(document)

  await sendMessageToMongoConsumer({
    collectionName,
    documentKey: { type: 'id', value: String(result.insertedId) },
    operationType: 'insert',
    clusterTime: Date.now(),
  })
}

export async function internalMongoBulkUpdate<T extends Document>(
  mongoClient: MongoClient,
  collectionName: string,
  operations: {
    updateOne: UpdateOneModel<T>
  }[]
) {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  await collection.bulkWrite(operations)

  await sendBulkMessagesToMongoConsumer(
    operations.map((operation) => ({
      collectionName,
      documentKey: {
        type: 'filter',
        value: operation.updateOne.filter as Filter<Document>,
      },
      operationType: 'update',
      clusterTime: Date.now(),
    }))
  )
}

export interface MongoUpdateMessage<T extends Document = Document> {
  filter: Filter<T>
  operationType: 'updateOne'
  updateMessage: UpdateFilter<T>
  sendToClickhouse: boolean
  collectionName: string
  upsert?: boolean
  arrayFilters?: Document[]
}

export async function sendMessageToMongoUpdateConsumer<
  T extends Document = Document
>(message: MongoUpdateMessage<T>) {
  if (envIs('local') || envIs('test')) {
    await executeMongoUpdate([message as MongoUpdateMessage<Document>])
    return
  }

  const sqs = getSQSClient()

  const messageCommand = new SendMessageCommand({
    QueueUrl: process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: generateChecksum(message.filter, 10),
    MessageDeduplicationId: generateChecksum(message, 10),
  })

  await sqs.send(messageCommand)
}

function replaceNinOperator(expression: any): any {
  if (typeof expression !== 'object' || expression === null) {
    return expression
  }

  if (Array.isArray(expression)) {
    return expression.map((item) => replaceNinOperator(item))
  }

  const result = { ...expression }

  for (const [key, value] of Object.entries(result)) {
    if (key === '$nin') {
      delete result[key]
      result['$not'] = { $in: value }
    } else if (typeof value === 'object') {
      result[key] = replaceNinOperator(value)
    }
  }

  return result
}

function addLevelRootPath(expression: any, root: string) {
  if (typeof expression !== 'object' || expression === null) {
    return expression
  }
  if (Array.isArray(expression)) {
    return expression.map((exp) => addLevelRootPath(exp, root))
  }
  const result = { ...expression }
  for (const [key, value] of Object.entries(expression)) {
    if (!key.startsWith('$')) {
      delete result[key]
      result[`${root}.${key}`] = addLevelRootPath(value, root)
    } else if (typeof value === 'object') {
      result[key] = addLevelRootPath(value, root)
    }
  }
  return result
}
const QUERY_ONLY_OPERATORS = [
  '$regex',
  '$options',
  '$size',
  '$exists',
  '$elemMatch',
]
function handleQueryOperatorsWhileConversion(
  op: string,
  val: Document,
  remainingPath: Array<string>,
  rootField: string,
  fieldAccessExpression: any
) {
  if (op === '$regex') {
    return {
      $regexMatch: {
        input: {
          $getField: {
            field: remainingPath.join('.'),
            input: `$$${rootField}`,
          },
        },
        regex: val,
      },
    }
  }
  if (op === '$options') {
    return ''
  }
  if (op === '$size') {
    return {
      $anyElementTrue: {
        $map: {
          input: fieldAccessExpression,
          as: 'item',
          in: true,
        },
      },
    }
  }

  if (op === '$exists') {
    return {
      $ne: [
        {
          $type: {
            $getField: {
              field: remainingPath.join('.'),
              input: `$$${rootField}`,
            },
          },
        },
        'missing',
      ],
    }
  }
  if (op === '$elemMatch') {
    return {
      $expr: {
        $cond: {
          if: { $isArray: fieldAccessExpression },
          then: {
            $anyElementTrue: {
              $map: {
                input: fieldAccessExpression,
                as: 'item',
                in: convertQueryToAggregationExpression(
                  addLevelRootPath(val, 'item') as Document
                ),
              },
            },
          },
          else: false, // If the field is not an array, $elemMatch should not match
        },
      },
    }
  }
}

// Convert query -
// { $and: [{ field1: { $gte: value, $lte: value } }, { field2: { $lte: value } }] }
// to aggregation expression -
// { $and: [{ $and: [ {$gte: [$$field1, value]}, {$lte: [$$field1, value]} ] }, { $lte: [$$field2, value] }] }
export function convertQueryToAggregationExpression(query: Document) {
  if (typeof query !== 'object' || query === null) {
    // Return primitive values (like numbers, strings, etc.) as is
    return query
  }

  if (Array.isArray(query)) {
    // Recursively process array elements
    return query.map((item) => convertQueryToAggregationExpression(item))
  }

  const keys = Object.keys(query)

  // Handle logical operators like $and, $or
  if (keys.length === 1 && keys[0].startsWith('$')) {
    const operator = keys[0]
    if (operator === '$and' || operator === '$or') {
      return {
        [operator]: query[operator].map((item) =>
          convertQueryToAggregationExpression(item)
        ),
      }
    }
  }

  // Handle conditions like {"field": { "$gte": value, "$lte": value }}
  if (!keys[0].startsWith('$')) {
    const field = keys[0]
    const condition = query[field]

    if (typeof condition === 'object' && condition !== null) {
      const expressions = Object.entries(condition)
        .map(([op, val]) => {
          const pathParts = field.split('.')
          const [rootField, ...remainingPath] = pathParts

          const fieldAccessExpression =
            remainingPath[0] === '' || !remainingPath[0]
              ? `$$${rootField}`
              : {
                  $getField: {
                    field: remainingPath[0],
                    input: `$$${rootField}`,
                  },
                }

          const finalFieldAccessor =
            remainingPath.slice(1).join('.') === '' ||
            !remainingPath.slice(1).join('.')
              ? `$$item`
              : {
                  $getField: {
                    field: remainingPath.slice(1).join('.'),
                    input: '$$item',
                  },
                }
          if (QUERY_ONLY_OPERATORS.includes(op)) {
            return handleQueryOperatorsWhileConversion(
              op,
              val as Document,
              remainingPath,
              rootField,
              fieldAccessExpression
            )
          }
          // Handle both array and non-array cases

          const expression = {
            $cond: {
              if: { $isArray: fieldAccessExpression },
              then: {
                $anyElementTrue: {
                  $map: {
                    input: fieldAccessExpression,
                    as: 'item',
                    in: {
                      [op]: [
                        finalFieldAccessor,
                        convertQueryToAggregationExpression(val as Document),
                      ],
                    },
                  },
                },
              },
              else: {
                [op]: [
                  {
                    $getField: {
                      field: remainingPath.join('.'),
                      input: `$$${rootField}`,
                    },
                  },
                  convertQueryToAggregationExpression(val as Document),
                ],
              },
            },
          }

          return {
            $expr: replaceNinOperator(expression),
          }
        })
        .filter((val) => val !== '')

      // Combine multiple conditions into $and
      if (expressions.length > 1) {
        return { $and: expressions }
      }
      return expressions[0] // Single condition
    }
    return {
      $eq: [
        {
          $getField: {
            field: field.split('.').slice(1).join('.'),
            input: `$$${field.split('.')[0]}`,
          },
        },
        condition,
      ],
    }
  }

  // Recursively process for nested objects
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      convertQueryToAggregationExpression(value),
    ])
  )
}

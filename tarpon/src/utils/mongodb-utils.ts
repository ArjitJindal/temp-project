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
  UpdateResult,
  WithId,
} from 'mongodb'

import { isEqual, memoize } from 'lodash'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { escapeStringRegexp } from './regex'
import { getSecretByName } from './secrets-manager'
import {
  DELTA_SANCTIONS_COLLECTION,
  DELTA_SANCTIONS_SEARCH_INDEX,
  getGlobalCollectionIndexes,
  getMongoDbIndexDefinitions,
  SANCTIONS_COLLECTION,
  SANCTIONS_SEARCH_INDEX,
  SANCTIONS_SEARCH_INDEX_DEFINITION,
} from './mongodb-definitions'
import { sendMessageToMongoConsumer } from './clickhouse/utils'
import { envIsNot } from './env'
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
import { logger } from '@/core/logger'
import { CounterRepository } from '@/services/counter/repository'
import { hasFeature } from '@/core/utils/context'

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

export const MONTH_DATE_FORMAT = '%Y-%m'
export const DAY_DATE_FORMAT = '%Y-%m-%d'
export const HOUR_DATE_FORMAT = '%Y-%m-%dT%H'

export const MONTH_DATE_FORMAT_JS = 'YYYY-MM'
export const DAY_DATE_FORMAT_JS = 'YYYY-MM-DD'
export const HOUR_DATE_FORMAT_JS = 'YYYY-MM-DD[T]HH'
export const DATE_TIME_FORMAT_JS = 'YYYY-MM-DD HH:mm:ss'

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
  const indexDefinitions = getGlobalCollectionIndexes()
  await createMongoDBCollectionsInternal(mongoClient, indexDefinitions)
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
    }
  },
  tenantId?: string
) => {
  const db = mongoClient.db()
  for (const collectionName in indexDefinitions) {
    const collection = await createCollectionIfNotExist(db, collectionName)
    const definition = indexDefinitions[collectionName]
    await syncIndexes(collection, definition.getIndexes())
  }
  if (!tenantId) {
    return
  }
  if (
    envIsNot('local', 'test') &&
    !isDemoTenant(tenantId) &&
    (hasFeature('DOW_JONES') || hasFeature('OPEN_SANCTIONS'))
  ) {
    await createSanctionSearchIndexes(db, tenantId)
  } else {
    await deleteIndex(
      db,
      SANCTIONS_COLLECTION(tenantId),
      SANCTIONS_SEARCH_INDEX(tenantId)
    )
    await deleteIndex(
      db,
      SANCTIONS_COLLECTION(tenantId),
      DELTA_SANCTIONS_SEARCH_INDEX(tenantId)
    )
  }
}

async function createSanctionSearchIndexes(db: Db, tenantId: string) {
  await createSearchIndex(
    db,
    SANCTIONS_COLLECTION(tenantId),
    SANCTIONS_SEARCH_INDEX_DEFINITION,
    SANCTIONS_SEARCH_INDEX(tenantId)
  )
  await createSearchIndex(
    db,
    DELTA_SANCTIONS_COLLECTION(tenantId),
    SANCTIONS_SEARCH_INDEX_DEFINITION,
    DELTA_SANCTIONS_COLLECTION(tenantId)
  )
}

async function createSearchIndex(
  db: Db,
  collectionName: string,
  definition: Document,
  indexName: string
) {
  const collection = db.collection(collectionName)
  if (
    (await db.listCollections({ name: collectionName }).toArray()).length > 1
  ) {
    await createIndex(collection, indexName, definition)
  }
}

async function createIndex(
  collection: Collection,
  index: string,
  definition: Document
) {
  const indexes = await collection.listSearchIndexes(index).toArray()
  if (indexes.length > 0) {
    await collection.updateSearchIndex(index, definition)
  } else {
    await collection.createSearchIndex({
      name: index,
      definition: definition,
    })
  }
}
async function deleteIndex(db: Db, collectionName: string, index: string) {
  const collection = db.collection(collectionName)

  if (
    (await db.listCollections({ name: collectionName }).toArray()).length > 1
  ) {
    const indexes = await collection.listSearchIndexes(index).toArray()
    if (indexes.length > 0) {
      console.log(`Dropping search index for sanctions - ${index}`)
      await collection.dropSearchIndex(index)
    }
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
  }
): Promise<ModifyResult<T>> {
  const db = mongoClient.db()
  const collection = db.collection<T>(collectionName)
  const data = await collection.findOneAndUpdate(filter, update, {
    returnDocument: 'after',
    upsert: true,
    ...(options?.arrayFilters ? { arrayFilters: options.arrayFilters } : {}),
    ...(options?.returnFullDocument ? {} : { projection: { _id: 1 } }),
    ...(options?.session ? { session: options.session } : {}),
  })

  const result = data.value as { _id: ObjectId }

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

export interface MongoUpdateMessage<T extends Document = Document> {
  filter: Filter<T>
  operationType: 'updateOne'
  updateMessage: UpdateFilter<T>
  sendToClickhouse: boolean
  collectionName: string
  upsert?: boolean
}

export async function sendMessageToMongoUpdateConsumer<
  T extends Document = Document
>(message: MongoUpdateMessage<T>) {
  const sqs = getSQSClient()

  const messageCommand = new SendMessageCommand({
    QueueUrl: process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: generateChecksum(message.filter, 10),
    MessageDeduplicationId: generateChecksum(message, 10),
  })

  await sqs.send(messageCommand)
}

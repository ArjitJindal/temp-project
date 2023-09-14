import { StackConstants } from '@lib/constants'
import {
  Collection,
  CreateIndexesOptions,
  Db,
  Document,
  FindCursor,
  FindOptions,
  MongoClient,
  WithId,
} from 'mongodb'

import { backOff } from 'exponential-backoff'
import { isEqual } from 'lodash'
import { escapeStringRegexp } from './regex'
import { getSecret } from './secrets-manager'
import { getMongoDbIndexDefinitions } from './mongodb-definitions'
import { MONGO_TEST_DB_NAME } from '@/test-utils/mongo-test-utils'
import {
  DEFAULT_PAGE_SIZE,
  getPageSizeNumber,
  MAX_PAGE_SIZE,
  OptionalPaginationParams,
  PageSize,
} from '@/utils/pagination'
import { logger } from '@/core/logger'

interface DBCredentials {
  username: string
  password: string
  host: string
}

let cacheClient: MongoClient

export async function getMongoDbClient(
  dbName = StackConstants.MONGO_DB_DATABASE_NAME
) {
  if (cacheClient) {
    return cacheClient
  }

  if (process.env.NODE_ENV === 'test') {
    cacheClient = await MongoClient.connect(
      process.env.MONGO_URI || `mongodb://localhost:27018/${MONGO_TEST_DB_NAME}`
    )
  } else if (process.env.ENV === 'local') {
    cacheClient = await MongoClient.connect(
      `mongodb://localhost:27018/${dbName}`
    )
  } else {
    const credentials = await getSecret<DBCredentials>(
      process.env.ATLAS_CREDENTIALS_SECRET_ARN as string
    )
    const DB_USERNAME = credentials['username']
    const DB_PASSWORD = encodeURIComponent(credentials['password'])
    const DB_HOST = credentials['host']
    const DB_URL = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}/${dbName}`
    cacheClient = await MongoClient.connect(DB_URL as string)
  }
  return cacheClient
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

/*
  Pagination
 */
export function getSkipAndLimit<Params extends OptionalPaginationParams>(
  params: Params
): {
  limit: number
  skip: number
} {
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

export function regexMatchFilter(input: string, caseInsensitive = false) {
  return {
    $regex: `${escapeStringRegexp(input)}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

async function createCollectionIfNotExist(
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
  const db = mongoClient.db()
  const indexDefinitions = getMongoDbIndexDefinitions(tenantId)
  for (const collectionName in indexDefinitions) {
    const collection = await createCollectionIfNotExist(db, collectionName)
    for (const definition of indexDefinitions[collectionName]) {
      await syncIndexes(
        collection,
        definition.getIndexes(),
        definition.unique
          ? {
              unique: definition.unique,
            }
          : undefined
      )
    }
  }
}

export async function allCollections(tenantId: string, db: Db) {
  const re = new RegExp(tenantId + `-((?!test).+)`)
  const collections = await db
    .listCollections({
      name: re,
    })
    .toArray()

  return collections.map((c) => c.name)
}

export async function syncIndexes<T>(
  collection: Collection<T extends Document ? T : Document>,
  indexes: Document[],
  options?: CreateIndexesOptions
) {
  const currentIndexes = await collection.indexes()

  // Remove orphaned indexes
  await Promise.all(
    currentIndexes.map(async (current) => {
      // Dont drop ID index
      if (current.name === '_id_') {
        return
      }

      // If index is not desired, delete it
      if (!indexes.find((desired) => isEqual(desired, current.key))) {
        await backOff(async () => await collection.dropIndex(current.name))
        logger.info(
          `Dropped index - ${current.name} (${collection.collectionName})`
        )
      }
    })
  )

  const indexesToCreate = indexes.filter(
    (desired) =>
      !currentIndexes.find((current) => isEqual(desired, current.key))
  )

  if (indexesToCreate.length > 64) {
    throw new Error("Can't create more than 64 indexes")
  }

  if (indexesToCreate.length > 0) {
    await Promise.all(
      indexesToCreate.map(async (index) => {
        await backOff(async () => await collection.createIndex(index, options))
        logger.info(
          `Created index - ${JSON.stringify(index)} (${
            collection.collectionName
          })`
        )
      })
    )
  }
}

export const withTransaction = async (callback: () => Promise<void>) => {
  const mongoDb = await getMongoDbClient()
  const session = mongoDb.startSession()

  session.startTransaction()
  try {
    await callback()
    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
}

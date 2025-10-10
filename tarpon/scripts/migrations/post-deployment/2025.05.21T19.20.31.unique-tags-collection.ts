import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  UNIQUE_TAGS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Tenant } from '@/@types/tenant'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  const db = mongodb.db()
  const uniqueTagsCollection = db.collection(UNIQUE_TAGS_COLLECTION(tenant.id))

  // if index doesn't exist, create it
  await uniqueTagsCollection.createIndex(
    { tag: 1, type: 1, value: 1 },
    { unique: true }
  )

  if (isClickhouseEnabledInRegion()) {
    let query = `
    SELECT DISTINCT 
      tupleElement(tag, 1) AS key, 
      tupleElement(tag, 2) AS value
    FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName}
    ARRAY JOIN tags AS tag
    WHERE 
      tupleElement(tag, 1) != '' AND 
      tupleElement(tag, 2) != ''
    LIMIT 100
    `
    let tags = await executeClickhouseQuery<{ key: string; value: string }[]>(
      tenant.id,
      query
    )

    if (tags.length > 0) {
      await uniqueTagsCollection
        .insertMany(
          tags.map((tag) => ({
            type: 'USER',
            tag: tag.key,
            value: tag.value,
          })),
          { ordered: false }
        )
        .catch((err) => {
          if (err.code !== 11000) {
            throw err
          }
        })
    }

    query = `
    SELECT DISTINCT 
      tupleElement(tag, 1) AS key, 
      tupleElement(tag, 2) AS value
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName}
    ARRAY JOIN tags AS tag
    WHERE 
      tupleElement(tag, 1) != '' AND 
      tupleElement(tag, 2) != ''
    LIMIT 100
    `
    tags = await executeClickhouseQuery<{ key: string; value: string }[]>(
      tenant.id,
      query
    )

    if (tags.length > 0) {
      await uniqueTagsCollection
        .insertMany(
          tags.map((tag) => ({
            type: 'TRANSACTION',
            tag: tag.key,
            value: tag.value,
          })),
          { ordered: false }
        )
        .catch((err) => {
          if (err.code !== 11000) {
            throw err
          }
        })
    }
    return
  }
  await db
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
    .aggregate([
      { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'tags.key': { $exists: true },
          'tags.value': { $exists: true },
        },
      },
      {
        $group: {
          _id: { key: '$tags.key', value: '$tags.value' },
          key: { $first: '$tags.key' },
          value: { $first: '$tags.value' },
        },
      },
      {
        $project: {
          _id: 0,
          type: { $literal: 'TRANSACTION' },
          tag: '$key',
          value: '$value',
        },
      },
      {
        $merge: {
          into: UNIQUE_TAGS_COLLECTION(tenant.id),
          on: ['type', 'tag', 'value'],
          whenMatched: 'keepExisting',
          whenNotMatched: 'insert',
        },
      },
    ])
    .next()

  await db
    .collection(USERS_COLLECTION(tenant.id))
    .aggregate([
      { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'tags.key': { $exists: true },
          'tags.value': { $exists: true },
        },
      },
      {
        $group: {
          _id: { key: '$tags.key', value: '$tags.value' },
          key: { $first: '$tags.key' },
          value: { $first: '$tags.value' },
        },
      },
      {
        $project: {
          _id: 0,
          type: { $literal: 'USER' },
          tag: '$key',
          value: '$value',
        },
      },
      {
        $merge: {
          into: UNIQUE_TAGS_COLLECTION(tenant.id),
          on: ['type', 'tag', 'value'],
          whenMatched: 'keepExisting',
          whenNotMatched: 'insert',
        },
      },
    ])
    .next()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

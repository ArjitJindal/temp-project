import { Collection, Document } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { Tenant } from '@/@types/tenant'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { processClickhouseInBatch } from '@/utils/clickhouse/clickhouse-batch'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import {
  CASES_COLLECTION,
  UNIQUE_TAGS_COLLECTION,
} from '@/utils/mongo-table-names'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tag } from '@/@types/openapi-internal/Tag'
import { Case } from '@/@types/openapi-internal/Case'

const BATCH_SIZE = 10000

async function backfillTags(
  tags: Tag[],
  uniqueTagsCollection: Collection<Document>,
  type: 'CASE' | 'ALERT'
) {
  if (tags.length > 0) {
    await uniqueTagsCollection
      .insertMany(
        tags.map((tag) => ({
          type,
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
}

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  const db = mongodb.db()
  const uniqueTagsCollection = db.collection(UNIQUE_TAGS_COLLECTION(tenant.id))

  if (isClickhouseEnabled()) {
    const clickhouseClient = await getClickhouseClient(tenant.id)

    // cases tags backfill
    await processClickhouseInBatch<{
      key: string
      value: string
      timestamp: number
      id: string
    }>(
      CLICKHOUSE_DEFINITIONS.CASES.tableName,
      async (tags) => {
        await backfillTags(tags, uniqueTagsCollection, 'CASE')
      },
      {
        clickhouseClient,
        additionalSelect: [
          { name: 'key', expr: 'tupleElement(tags, 1)' },
          { name: 'value', expr: 'tupleElement(tags, 2)' },
        ],
        clickhouseBatchSize: BATCH_SIZE,
        processBatchSize: BATCH_SIZE,
        additionalJoin: 'tags',
        additionalWhere:
          "tupleElement(tags, 1) != '' AND tupleElement(tags, 2) != ''",
      }
    )

    //alerts backfill
    await processClickhouseInBatch<{
      key: string
      value: string
      timestamp: number
      id: string
    }>(
      CLICKHOUSE_DEFINITIONS.CASES.tableName,
      async (tags) => {
        await backfillTags(tags, uniqueTagsCollection, 'ALERT')
      },
      {
        clickhouseClient,
        additionalSelect: [
          { name: 'key', expr: 'tupleElement(tag, 1)' },
          { name: 'value', expr: 'tupleElement(tag, 2)' },
        ],
        clickhouseBatchSize: BATCH_SIZE,
        processBatchSize: BATCH_SIZE,
        additionalJoin: ['alerts AS alert', 'alert.tags AS tag'],
        additionalWhere:
          "tupleElement(tag, 1) != '' AND tupleElement(tag, 2) != ''",
      }
    )
  } else {
    await db
      .collection<Case>(CASES_COLLECTION(tenant.id))
      .aggregate([
        {
          $unwind: {
            path: '$caseAggregates.tags',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            'caseAggregates.tags.key': { $exists: true },
            'caseAggregates.tags.value': { $exists: true },
          },
        },
        {
          $group: {
            _id: {
              key: '$caseAggregates.tags.key',
              value: '$caseAggregates.tags.value',
            },
            key: { $first: '$caseAggregates.tags.key' },
            value: { $first: '$caseAggregates.tags.value' },
          },
        },
        {
          $project: {
            _id: 0,
            type: { $literal: 'CASE' },
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

    // alerts
    await db
      .collection<Case>(CASES_COLLECTION(tenant.id))
      .aggregate([
        {
          $unwind: {
            path: '$alerts',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $unwind: {
            path: '$alerts.tags',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            'alerts.tags.key': { $exists: true },
            'alerts.tags.value': { $exists: true },
          },
        },
        {
          $group: {
            _id: { key: '$alerts.tags.key', value: '$alerts.tags.value' },
            key: { $first: '$alerts.tags.key' },
            value: { $first: '$alerts.tags.value' },
          },
        },
        {
          $project: {
            _id: 0,
            type: { $literal: 'ALERT' },
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
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

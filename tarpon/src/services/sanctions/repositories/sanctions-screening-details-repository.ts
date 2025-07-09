import { MongoClient, Document, UpdateFilter, Filter } from 'mongodb'
import { isNil, omitBy, sum } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs'
import {
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_V2_COLLECTION,
} from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { DefaultApiGetSanctionsScreeningActivityDetailsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import {
  MongoUpdateMessage,
  paginatePipeline,
  sendMessageToMongoUpdateConsumer,
} from '@/utils/mongodb-utils'
import { COUNT_QUERY_LIMIT, offsetPaginateClickhouse } from '@/utils/pagination'
import { SANCTIONS_SCREENING_ENTITYS } from '@/@types/openapi-internal-custom/SanctionsScreeningEntity'
import { BooleanString } from '@/@types/openapi-internal/BooleanString'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  sendMessageToMongoConsumer,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { hasFeature } from '@/core/utils/context'
import { SanctionsScreeningEntityStats } from '@/@types/openapi-internal/SanctionsScreeningEntityStats'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { getTriggerSource } from '@/utils/lambda'
import { SanctionsScreeningDetailsV2 } from '@/@types/openapi-internal/SanctionsScreeningDetailsV2'
import { CounterRepository } from '@/services/counter/repository'
import { bulkSendMessages } from '@/utils/sns-sqs-client'
import { getDynamoDbClient } from '@/utils/dynamodb'

@traceable
export class SanctionsScreeningDetailsRepository {
  private readonly tenantId: string
  private readonly mongoDb: MongoClient
  private readonly sqsClient: SQSClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.sqsClient = new SQSClient({})
  }

  public async addSanctionsScreeningDetails(
    details: Omit<SanctionsScreeningDetails, 'lastScreenedAt'>,
    screenedAt = Date.now()
  ): Promise<void> {
    const sanctionsScreeningCollectionName =
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)

    const roundedScreenedAt = dayjs(screenedAt).startOf('hour').valueOf()

    const filter = {
      name: details.name,
      entity: details.entity,
      lastScreenedAt: roundedScreenedAt,
    }

    const {
      ruleInstanceIds = [],
      userIds = [],
      transactionIds = [],
      ...detailsWithoutSets
    } = details

    const update: UpdateFilter<SanctionsScreeningDetails> = {
      $set: { ...detailsWithoutSets, lastScreenedAt: roundedScreenedAt },
      $setOnInsert: { isNew: true },
      $addToSet: {
        ruleInstanceIds: { $each: ruleInstanceIds },
        userIds: { $each: userIds },
        transactionIds: { $each: transactionIds },
      },
    }

    const messageBody: MongoUpdateMessage<SanctionsScreeningDetails> = {
      filter,
      operationType: 'updateOne',
      updateMessage: update,
      sendToClickhouse: true,
      collectionName: sanctionsScreeningCollectionName,
      upsert: true,
    }

    if (envIs('local') || envIs('test')) {
      await this.callMongoDatabase(filter, update)
      return
    }

    if (getTriggerSource() !== 'PUBLIC_API') {
      await this.callMongoDatabase(filter, update)
      return
    }

    try {
      await sendMessageToMongoUpdateConsumer(messageBody)
    } catch (e) {
      logger.warn(
        `Failed to send message to mongo update consumer for sanctions screening details: ${e}`
      )

      await this.callMongoDatabase(filter, update)
    }
  }

  public async addSanctionsScreeningDetailsV2(
    details: Omit<SanctionsScreeningDetails, 'lastScreenedAt'>,
    screenedAt = Date.now()
  ): Promise<void> {
    const sanctionsScreeningCollectionNameV2 =
      SANCTIONS_SCREENING_DETAILS_V2_COLLECTION(this.tenantId)

    const roundedScreenedAt = dayjs(screenedAt).startOf('hour').valueOf()
    const currentTimestamp = Date.now()

    const { ruleInstanceIds = [], userIds = [], transactionIds = [] } = details

    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: getDynamoDbClient(),
    })

    const commonUpdatePart: Partial<SanctionsScreeningDetailsV2> = {
      name: details.name,
      entity: details.entity,
      isOngoingScreening: details.isOngoingScreening,
      isHit: details.isHit,
      searchId: details.searchId,
      latestTimeStamp: currentTimestamp,
    }

    const userItems = userIds.map((id) => ({ type: 'userId', id }))
    const transactionItems = transactionIds.map((id) => ({
      type: 'transactionId',
      id,
    }))
    const allItems = [...userItems, ...transactionItems]
    const messagesV2: Array<Omit<SendMessageBatchRequestEntry, 'Id'>> = []

    for (const item of allItems) {
      const screeningId = `S-${await counterRepository.getNextCounterAndUpdate(
        'ScreeningDetails'
      )}`

      const updateMessageV2: UpdateFilter<SanctionsScreeningDetailsV2> = {
        $set: {
          ...commonUpdatePart,
          [item.type]: item.id,
          lastScreenedAt: roundedScreenedAt,
        },
        $setOnInsert: {
          screeningId,
          isNew: true,
        },
        $addToSet: {
          ruleInstanceIds: { $each: ruleInstanceIds },
        },
      }

      messagesV2.push({
        MessageBody: JSON.stringify({
          filter: { lastScreenedAt: roundedScreenedAt, [item.type]: item.id },
          operationType: 'updateOne',
          updateMessage: updateMessageV2,
          sendToClickhouse: true,
          collectionName: sanctionsScreeningCollectionNameV2,
          upsert: true,
        }),
        MessageDeduplicationId: `${item.id}-${roundedScreenedAt}`,
      })
    }

    if (envIs('local') || envIs('test')) {
      // For local and test environments, directly call the database
      for (const message of messagesV2) {
        const messageBody = JSON.parse(message.MessageBody || '{}')
        await this.callMongoDatabaseV2(
          messageBody.filter,
          messageBody.updateMessage
        )
      }
      return
    }

    if (messagesV2.length > 0) {
      const queueUrl = process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL
      if (!queueUrl) {
        throw new Error(
          'MONGO_UPDATE_CONSUMER_QUEUE_URL environment variable is not set'
        )
      }
      await bulkSendMessages(this.sqsClient, queueUrl, messagesV2)
    }
  }

  private async callMongoDatabase(
    filter: Filter<SanctionsScreeningDetails>,
    update: UpdateFilter<SanctionsScreeningDetails>
  ) {
    const db = this.mongoDb.db()
    const sanctionsScreeningCollectionName =
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)

    const updatedData = await db
      .collection<SanctionsScreeningDetails>(sanctionsScreeningCollectionName)
      .findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: 'after',
      })

    const _id = updatedData.value?._id

    if (_id) {
      await sendMessageToMongoConsumer({
        collectionName: sanctionsScreeningCollectionName,
        documentKey: { type: 'id', value: String(_id) },
        operationType: 'update',
        clusterTime: Date.now(),
      })
    }
  }

  private async callMongoDatabaseV2(
    filter: Filter<SanctionsScreeningDetailsV2>,
    update: UpdateFilter<SanctionsScreeningDetailsV2>
  ) {
    const db = this.mongoDb.db()
    const sanctionsScreeningCollectionNameV2 =
      SANCTIONS_SCREENING_DETAILS_V2_COLLECTION(this.tenantId)

    await db
      .collection<SanctionsScreeningDetailsV2>(
        sanctionsScreeningCollectionNameV2
      )
      .findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: 'after',
      })
  }

  private async getSanctionsScreeningStatsClickhouse(timestampRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)

    const query = `
    SELECT
      entity,
      count() as screenedCount,
      sum(isHit = true) as hitCount,
      sum(isNew = true) as newCount
    FROM
      sanctions_screening_details FINAL
    ${
      timestampRange
        ? `WHERE timestamp BETWEEN ${timestampRange.from} AND ${timestampRange.to}`
        : ''
    }
    GROUP BY
      entity,
      isHit,
      isNew
    SETTINGS output_format_json_quote_64bit_integers = 0
    `

    const data = await clickhouseClient.query({
      query,
      format: 'JSONEachRow',
    })

    const result = await data.json<SanctionsScreeningEntityStats>()

    return {
      data: SANCTIONS_SCREENING_ENTITYS.map((entity) => {
        const screenedCount = sum(
          result.filter((r) => r.entity === entity).map((v) => v.screenedCount)
        )
        const newCount = sum(
          result.filter((r) => r.entity === entity).map((v) => v.newCount)
        )
        return {
          entity,
          screenedCount,
          newCount,
          hitCount: sum(
            result.filter((r) => r.entity === entity).map((v) => v.hitCount)
          ),
        }
      }),
    }
  }

  public async getSanctionsScreeningStats(timestampRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
    if (hasFeature('CLICKHOUSE_ENABLED')) {
      return this.getSanctionsScreeningStatsClickhouse(timestampRange)
    }

    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsScreeningDetails>(
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)
    )
    const pipeline = [
      {
        $match: {
          lastScreenedAt: {
            $gte: timestampRange?.from ?? 0,
            $lte: timestampRange?.to ?? Number.MAX_SAFE_INTEGER,
          },
        },
      },
      {
        $group: {
          _id: {
            name: '$name',
            entity: '$entity',
          },
          isHits: { $addToSet: '$isHit' },
          isNews: { $addToSet: '$isNew' },
        },
      },
      {
        $addFields: {
          isHit: { $anyElementTrue: ['$isHits'] },
          isNew: { $anyElementTrue: ['$isNews'] },
        },
      },
      {
        $group: {
          _id: {
            entity: '$_id.entity',
            isHit: '$isHit',
            isNew: '$isNew',
          },
          count: { $sum: 1 },
        },
      },
    ]
    const result = await collection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()
    return {
      data: SANCTIONS_SCREENING_ENTITYS.map((entity) => {
        const screenedCount = sum(
          result.filter((r) => r._id.entity === entity).map((v) => v.count)
        )
        const newCount = sum(
          result
            .filter((r) => r._id.entity === entity && r._id.isNew)
            .map((v) => v.count)
        )
        const hitCount = sum(
          result
            .filter((r) => r._id.entity === entity && r._id.isHit)
            .map((v) => v.count)
        )
        return {
          entity,
          screenedCount,
          hitCount,
          newCount,
        }
      }),
    }
  }

  private async getSanctionsScreeningStatsV2Clickhouse(timestampRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)

    const query = `
    WITH entity_type AS (
  SELECT
    entity,
    CASE 
      WHEN entity = 'USER' THEN userId 
      WHEN entity = 'TRANSACTION' THEN transactionId 
    END as entity_id,
    isHit,
    isNew
  FROM
        ${CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS_V2.tableName} FINAL
      ${
        timestampRange
          ? `WHERE timestamp BETWEEN ${timestampRange.from} AND ${timestampRange.to}`
          : ''
      }
)
SELECT
  entity,
  countDistinct(entity_id) as screenedCount,
  sum(isHit = true) as hitCount,
  sum(isNew = true) as newCount
FROM entity_type
GROUP BY
  entity
SETTINGS output_format_json_quote_64bit_integers = 0
    `

    const result = await executeClickhouseQuery<
      SanctionsScreeningEntityStats[]
    >(clickhouseClient, query)

    return {
      data: SANCTIONS_SCREENING_ENTITYS.map((entity) => {
        const stats = result.find((r) => r.entity === entity)
        return {
          entity,
          screenedCount: stats?.screenedCount ?? 0,
          hitCount: stats?.hitCount ?? 0,
          newCount: stats?.newCount ?? 0,
        }
      }),
    }
  }

  public async getSanctionsScreeningStatsV2(timestampRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
    if (hasFeature('CLICKHOUSE_ENABLED')) {
      return this.getSanctionsScreeningStatsV2Clickhouse(timestampRange)
    }

    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsScreeningDetailsV2>(
      SANCTIONS_SCREENING_DETAILS_V2_COLLECTION(this.tenantId)
    )
    const pipeline = [
      {
        $match: {
          lastScreenedAt: {
            $gte: timestampRange?.from ?? 0,
            $lte: timestampRange?.to ?? Number.MAX_SAFE_INTEGER,
          },
        },
      },
      {
        $group: {
          _id: {
            entity: '$entity',
            id: {
              $cond: {
                if: { $eq: ['$entity', 'USER'] },
                then: '$userId',
                else: '$transactionId',
              },
            },
          },
          isHit: { $max: '$isHit' },
          isNew: { $max: '$isNew' },
        },
      },
      {
        $group: {
          _id: '$_id.entity',
          screenedCount: { $sum: 1 },
          hitCount: { $sum: { $cond: [{ $eq: ['$isHit', true] }, 1, 0] } },
          newCount: { $sum: { $cond: [{ $eq: ['$isNew', true] }, 1, 0] } },
        },
      },
    ]
    const result = await collection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()
    return {
      data: SANCTIONS_SCREENING_ENTITYS.map((entity) => {
        const stats = result.find((r) => r._id === entity)
        return {
          entity,
          screenedCount: stats?.screenedCount ?? 0,
          hitCount: stats?.hitCount ?? 0,
          newCount: stats?.newCount ?? 0,
        }
      }),
    }
  }

  private getSanctionsScreeningDetailsClickhouseQuery(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): string {
    const where: string[] = []

    if (params.afterTimestamp && params.beforeTimestamp) {
      where.push(
        `timestamp BETWEEN ${params.afterTimestamp} AND ${params.beforeTimestamp}`
      )
    } else {
      if (params.afterTimestamp) {
        where.push(`timestamp >= ${params.afterTimestamp}`)
      }

      if (params.beforeTimestamp) {
        where.push(`timestamp <= ${params.beforeTimestamp}`)
      }
    }

    if (params.filterEntities) {
      where.push(
        `entity IN (${params.filterEntities.map((e) => `'${e}'`).join(',')})`
      )
    }

    if (params.filterName) {
      where.push(`positionCaseInsensitive(name, '${params.filterName}')`)
    }

    if (params.filterIsHit != null) {
      if (params.filterIsHit == 'true') {
        where.push('isHit = 1')
      } else {
        where.push('isHit != 1')
      }
    }

    if (params.filterIsOngoingScreening != null) {
      if (params.filterIsOngoingScreening == 'true') {
        where.push('isOngoingScreening = 1')
      } else {
        where.push('isOngoingScreening != 1')
      }
    }

    if (params.filterIsNew != null) {
      if (params.filterIsNew == 'true') {
        where.push('isNew = 1')
      } else {
        where.push('isNew != 1')
      }
    }
    return where.join(' AND ')
  }

  private getSanctionsScreeningDetailsPipeline(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Document[] {
    function flattenArrays(field: string) {
      return {
        $reduce: {
          input: `$${field}`,
          initialValue: [],
          in: { $setUnion: ['$$value', { $ifNull: ['$$this', []] }] },
        },
      }
    }
    function getBooleanFilter(value: BooleanString | undefined) {
      if (!value) {
        return undefined
      }
      return value === 'true' ? { $eq: true } : { $ne: true }
    }
    return [
      {
        $match: omitBy(
          {
            lastScreenedAt: {
              $gte: params.afterTimestamp || 0,
              $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
            },
            entity: params.filterEntities
              ? { $in: params.filterEntities }
              : undefined,
            name: params.filterName
              ? { $regex: params.filterName, $options: 'i' }
              : undefined,
            isHit: getBooleanFilter(params.filterIsHit),
            isOngoingScreening: getBooleanFilter(
              params.filterIsOngoingScreening
            ),
            isNew: getBooleanFilter(params.filterIsNew),
          },
          isNil
        ),
      },
      {
        $sort: { lastScreenedAt: -1 },
      },
      {
        $group: {
          _id: {
            name: '$name',
            entity: '$entity',
          },
          ruleInstanceIds: {
            $push: '$ruleInstanceIds',
          },
          userIds: {
            $push: '$userIds',
          },
          transactionIds: {
            $push: '$transactionIds',
          },
          isOngoingScreenings: { $addToSet: '$isOngoingScreening' },
          isHits: { $addToSet: '$isHit' },
          isNews: { $addToSet: '$isNew' },
          searchId: { $last: '$searchId' },
          lastScreenedAt: { $first: '$lastScreenedAt' },
        },
      },
      {
        $addFields: {
          name: '$_id.name',
          entity: '$_id.entity',
          ruleInstanceIds: flattenArrays('ruleInstanceIds'),
          userIds: flattenArrays('userIds'),
          transactionIds: flattenArrays('transactionIds'),
          isOngoingScreening: { $anyElementTrue: ['$isOngoingScreenings'] },
          isHit: { $anyElementTrue: ['$isHits'] },
          isNew: { $anyElementTrue: ['$isNews'] },
        },
      },
    ]
  }

  private async getSanctionsScreeningDetailsClickhouse(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const query = this.getSanctionsScreeningDetailsClickhouseQuery(params)

    const data = await offsetPaginateClickhouse<SanctionsScreeningDetails>(
      clickhouseClient,
      CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.materializedViews.BY_ID
        .viewName,
      CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
      {
        page: params.page,
        pageSize: params.pageSize,
        sortField: 'timestamp',
        sortOrder: 'descend',
      },
      query,
      { data: 'data' },
      (item) => JSON.parse(item.data as string) as SanctionsScreeningDetails
    )

    return { total: data.count, data: data.items }
  }

  public async getSanctionsScreeningDetails(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    if (hasFeature('CLICKHOUSE_ENABLED')) {
      return this.getSanctionsScreeningDetailsClickhouse(params)
    }

    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsScreeningDetails>(
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)
    )
    const sharedPipeline = this.getSanctionsScreeningDetailsPipeline(params)
    const dataPipeline = sharedPipeline.concat([
      { $sort: { name: 1 } },
      ...paginatePipeline(params),
    ])
    const countPipeline = sharedPipeline.concat([
      { $limit: COUNT_QUERY_LIMIT },
      { $count: 'count' },
    ])
    const [data, totalResult] = await Promise.all([
      collection
        .aggregate<SanctionsScreeningDetails>(dataPipeline, {
          allowDiskUse: true,
        })
        .toArray(),
      collection
        .aggregate(countPipeline, {
          allowDiskUse: true,
        })
        .next(),
    ])
    return { total: totalResult?.count ?? 0, data }
  }
}

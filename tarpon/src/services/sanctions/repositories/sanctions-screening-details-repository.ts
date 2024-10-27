import { MongoClient, Document } from 'mongodb'
import { isNil, omitBy, sum, uniq } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { SANCTIONS_SCREENING_DETAILS_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { DefaultApiGetSanctionsScreeningActivityDetailsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { internalMongoReplace, paginatePipeline } from '@/utils/mongodb-utils'
import { COUNT_QUERY_LIMIT, offsetPaginateClickhouse } from '@/utils/pagination'
import { SANCTIONS_SCREENING_ENTITYS } from '@/@types/openapi-internal-custom/SanctionsScreeningEntity'
import { BooleanString } from '@/@types/openapi-internal/BooleanString'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { hasFeature } from '@/core/utils/context'
import { SanctionsScreeningEntityStats } from '@/@types/openapi-internal/SanctionsScreeningEntityStats'

@traceable
export class SanctionsScreeningDetailsRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async addSanctionsScreeningDetails(
    details: Omit<SanctionsScreeningDetails, 'lastScreenedAt'>,
    screenedAt = Date.now()
  ): Promise<void> {
    const db = this.mongoDb.db()
    const sanctionsScreeningCollectionName =
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)

    const collection = db.collection<SanctionsScreeningDetails>(
      sanctionsScreeningCollectionName
    )

    const previousScreenResult = await collection.findOne({
      lastScreenedAt: { $lt: screenedAt },
      name: details.name,
      entity: details.entity,
    })
    // NOTE: Round the timestamp to the nearest hour to avoid having too many records
    const roundedScreenedAt = dayjs(screenedAt).startOf('hour').valueOf()
    const filter = {
      name: details.name,
      entity: details.entity,
      lastScreenedAt: roundedScreenedAt,
    }
    const existingRecord = await collection.findOne(filter)

    await internalMongoReplace(
      this.mongoDb,
      sanctionsScreeningCollectionName,
      filter,
      {
        ...existingRecord,
        ...details,
        ruleInstanceIds: uniq(
          (existingRecord?.ruleInstanceIds ?? []).concat(
            details.ruleInstanceIds ?? []
          )
        ),
        userIds: uniq(
          (existingRecord?.userIds ?? []).concat(details.userIds ?? [])
        ),
        transactionIds: uniq(
          (existingRecord?.transactionIds ?? []).concat(
            details.transactionIds ?? []
          )
        ),
        lastScreenedAt: roundedScreenedAt,
        isNew: !previousScreenResult,
      }
    )
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
    WHERE
      timestamp >= ${timestampRange?.from ?? 0} AND timestamp <= ${
      timestampRange?.to ?? Number.MAX_SAFE_INTEGER
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

  private getSanctionsScreeningDetailsClickhouseQuery(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): string {
    const where: string[] = []

    if (params.afterTimestamp) {
      where.push(`timestamp >= ${params.afterTimestamp}`)
    }

    if (params.beforeTimestamp) {
      where.push(`timestamp <= ${params.beforeTimestamp}`)
    }

    if (params.filterEntities) {
      where.push(
        `entity IN (${params.filterEntities.map((e) => `'${e}'`).join(',')})`
      )
    }

    if (params.filterName) {
      where.push(`name LIKE '%${params.filterName}%'`)
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

  public async getSanctionsScreeningDetailsClickhouse(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const query = this.getSanctionsScreeningDetailsClickhouseQuery(params)

    const data = await offsetPaginateClickhouse<SanctionsScreeningDetails>(
      this.tenantId,
      clickhouseClient,
      CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
      CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
      {
        page: params.page,
        pageSize: params.pageSize,
        sortField: 'timestamp',
        sortOrder: 'descend',
      },
      query,
      { bypassNestedQuery: true }
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

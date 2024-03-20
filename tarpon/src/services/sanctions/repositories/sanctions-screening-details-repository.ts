import { MongoClient, Document } from 'mongodb'
import { isNil, omitBy, sum, uniq } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { SANCTIONS_SCREENING_DETAILS_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { DefaultApiGetSanctionsScreeningActivityDetailsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { paginatePipeline } from '@/utils/mongodb-utils'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'
import { SANCTIONS_SCREENING_ENTITYS } from '@/@types/openapi-internal-custom/SanctionsScreeningEntity'
import { BooleanString } from '@/@types/openapi-internal/BooleanString'

@traceable
export class SanctionsScreeningDetailsRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async addSanctionsScreeningDetails(
    details: SanctionsScreeningDetails,
    screenedAt = Date.now()
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsScreeningDetails>(
      SANCTIONS_SCREENING_DETAILS_COLLECTION(this.tenantId)
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
    await collection.replaceOne(
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
      },
      { upsert: true }
    )
  }

  public async getSanctionsScreeningStats(timestampRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
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
          lastScreenedAt: { $max: '$lastScreenedAt' },
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

  public async getSanctionsScreeningDetails(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
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

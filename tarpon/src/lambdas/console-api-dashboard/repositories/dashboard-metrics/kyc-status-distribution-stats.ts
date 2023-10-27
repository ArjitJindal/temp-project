import { WithId } from 'mongodb'
import { DashboardStatsKYCDistributionData } from '../types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  KYC_STATUS_DISTRIBUTION_STATS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { KYC_STATUSS } from '@/@types/openapi-public-custom/KYCStatus'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { DashboardStatsKYCStatusDistributionData as KYCSStatusDistributionStats } from '@/@types/openapi-internal/DashboardStatsKYCStatusDistributionData'
function createDistributionItems(
  groups: WithId<DashboardStatsKYCDistributionData>[]
) {
  let total = 0
  groups.map((group: WithId<DashboardStatsKYCDistributionData>) => {
    total += group.count
  })
  const result: KYCSStatusDistributionStats[] = []
  groups.map((group: any) => {
    KYC_STATUSS.map((status: KYCStatus) => {
      if (group._id === status) {
        result.push({
          kycStatus: status,
          count: group.count,
          percentage: ((100 * group.count) / total).toFixed(2),
        })
      }
    })
  })
  return result
}

export class KYCStatusDistributionStatsDashboardMetric {
  public static async refresh(tenantId): Promise<void> {
    const db = await getMongoDbClientDb()
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    const aggregationCollection =
      KYC_STATUS_DISTRIBUTION_STATS_COLLECTION(tenantId)

    const pipeline = [
      {
        $match: {
          'kycStatusDetails.status': { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $facet: {
          business: [
            {
              $match: { type: 'BUSINESS' },
            },
            {
              $group: {
                _id: '$kycStatusDetails.status',
                count: { $sum: 1 },
              },
            },
          ],
          consumer: [
            {
              $match: { type: 'CONSUMER' },
            },
            {
              $group: {
                _id: '$kycStatusDetails.status',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: 'all',
          business: { $first: '$business' },
          consumer: { $first: '$consumer' },
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          whenMatched: 'merge',
        },
      },
    ]
    const lastUpdatedAt = Date.now()
    await usersCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt), { allowDiskUse: true })
      .next()
    await cleanUpStaleData(aggregationCollection, 'date', lastUpdatedAt)
  }

  public static async get(
    tenantId: string,
    userType: 'BUSINESS' | 'CONSUMER'
  ): Promise<KYCSStatusDistributionStats[]> {
    const db = await getMongoDbClientDb()
    const collection = db.collection<{
      _id: string
      business: DashboardStatsKYCDistributionData[]
      consumer: DashboardStatsKYCDistributionData[]
    }>(KYC_STATUS_DISTRIBUTION_STATS_COLLECTION(tenantId))
    const result = await collection.find({ _id: { $exists: true } }).toArray()
    const stats =
      userType === 'BUSINESS' ? result[0]?.business : result[0]?.consumer
    const distributionItems = createDistributionItems(stats ?? [])

    return distributionItems
  }
}

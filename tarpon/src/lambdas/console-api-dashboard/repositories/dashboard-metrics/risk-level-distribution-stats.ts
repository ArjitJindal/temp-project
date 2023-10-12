import { WithId } from 'mongodb'
import { DashboardStatsRiskLevelDistributionData } from '../types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import { DashboardStatsRiskLevelDistributionData as RiskLevelDistributionStats } from '@/@types/openapi-internal/DashboardStatsRiskLevelDistributionData'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  DRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
  KRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'

function sanitizeBucketBoundry(riskIntervalBoundries: Array<number>) {
  if (!riskIntervalBoundries) {
    return []
  }
  const legitIntervalBoundry = [riskIntervalBoundries[0]]
  for (let i = 1; i < riskIntervalBoundries.length; i++) {
    if (riskIntervalBoundries[i] === riskIntervalBoundries[i - 1]) {
      legitIntervalBoundry.push(riskIntervalBoundries[i] + 0.01)
    } else if (riskIntervalBoundries[i] < riskIntervalBoundries[i - 1]) {
      legitIntervalBoundry.push(riskIntervalBoundries[i - 1] + 0.01)
    } else {
      legitIntervalBoundry.push(riskIntervalBoundries[i])
    }
  }
  return legitIntervalBoundry
}

function createDistributionItems(
  riskClassificationValues: RiskClassificationScore[],
  buckets: WithId<DashboardStatsRiskLevelDistributionData>[]
) {
  let total = 0
  buckets.map((bucket: any) => {
    total += bucket.count
  })
  const result: RiskLevelDistributionStats[] = []
  buckets.map((bucket: any) => {
    riskClassificationValues.map(
      (classificationValue: RiskClassificationScore) => {
        if (bucket._id === classificationValue.lowerBoundRiskScore) {
          result.push({
            riskLevel: classificationValue.riskLevel,
            count: bucket.count,
            percentage: ((100 * bucket.count) / total).toFixed(2),
            riskScoreRange: `${classificationValue.lowerBoundRiskScore} - ${classificationValue.upperBoundRiskScore}`,
          })
        }
      }
    )
  })
  return result
}

export class RiskLevelDistributionStatsDashboardMetric {
  public static async refresh(tenantId: string): Promise<void> {
    if (!(await tenantHasFeature(tenantId, 'RISK_SCORING'))) {
      return
    }

    const db = await getMongoDbClientDb()
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    const dynamoDb = getDynamoDbClient()

    const aggregationDRSCollection =
      DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenantId)
    const aggregationKRSCollection =
      KRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenantId)

    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const riskIntervalBoundries = riskClassificationValues.map(
      (classificationValue: RiskClassificationScore) =>
        classificationValue.lowerBoundRiskScore
    )
    riskIntervalBoundries.push(
      riskClassificationValues[riskClassificationValues.length - 1]
        .upperBoundRiskScore
    )
    // We need to sanitize the boundry - it must be strictly increasing. Limited info from mongo on the error code 40194
    // You can view the error log here: https://github.com/bwaldvogel/mongo-java-server/blob/main/test-common/src/main/java/de/bwaldvogel/mongo/backend/AbstractAggregationTest.java
    const sanitizedBounries = [
      ...new Set(sanitizeBucketBoundry(riskIntervalBoundries)), // duplicate values are not allowed in bucket boundaries
    ]

    const pipeline = (type: 'drs' | 'krs', aggregationCollection: string) => [
      {
        $match: {
          [`${type}Score.${type}Score`]: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $facet: {
          business: [
            {
              $match: { type: 'BUSINESS' },
            },
            {
              $bucket: {
                groupBy: `$${type}Score.${type}Score`,
                boundaries: sanitizedBounries,
                default: sanitizedBounries[sanitizedBounries.length - 1],
                output: {
                  count: { $sum: 1 },
                },
              },
            },
          ],
          consumer: [
            {
              $match: { type: 'CONSUMER' },
            },
            {
              $bucket: {
                groupBy: `$${type}Score.${type}Score`,
                boundaries: sanitizedBounries,
                default: sanitizedBounries[sanitizedBounries.length - 1],
                output: {
                  count: { $sum: 1 },
                },
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
      .aggregate(
        withUpdatedAt(pipeline('drs', aggregationDRSCollection), lastUpdatedAt),
        {
          allowDiskUse: true,
        }
      )
      .next()
    await usersCollection
      .aggregate(
        withUpdatedAt(pipeline('krs', aggregationKRSCollection), lastUpdatedAt),
        {
          allowDiskUse: true,
        }
      )
      .next()
    await cleanUpStaleData(aggregationDRSCollection, 'date', lastUpdatedAt)
    await cleanUpStaleData(aggregationKRSCollection, 'date', lastUpdatedAt)
  }

  public static async get(
    tenantId: string,
    userType: 'BUSINESS' | 'CONSUMER',
    riskType: 'CRA' | 'KRS'
  ): Promise<RiskLevelDistributionStats[]> {
    const db = await getMongoDbClientDb()
    const DRSCollection = db.collection<{
      _id: string
      business: DashboardStatsRiskLevelDistributionData[]
      consumer: DashboardStatsRiskLevelDistributionData[]
    }>(DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenantId))
    const KRSCollection = db.collection<{
      _id: string
      business: DashboardStatsRiskLevelDistributionData[]
      consumer: DashboardStatsRiskLevelDistributionData[]
    }>(KRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenantId))
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const result =
      riskType === 'CRA'
        ? await DRSCollection.find({}).toArray()
        : await KRSCollection.find({}).toArray()
    const stats =
      userType === 'BUSINESS' ? result[0]?.business : result[0]?.consumer
    const distributionItems = createDistributionItems(
      riskClassificationValues,
      stats ?? []
    )

    return distributionItems
  }
}

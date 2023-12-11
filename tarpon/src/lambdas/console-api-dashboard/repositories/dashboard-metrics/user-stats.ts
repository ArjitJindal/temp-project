import { keyBy } from 'lodash'
import { getTimeLabels } from '../../utils'
import { GranularityValuesType, TimeRange } from '../types'
import {
  cleanUpStaleData,
  getAttributeCountStatsPipeline,
  getAttributeSumStatsDerivedPipeline,
  withUpdatedAt,
} from './utils'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
  getMongoDbClientDb,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/utils/mongodb-utils'
import {
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_MONTHLY,
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_MONTHLY,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsUsersStats } from '@/@types/openapi-internal/DashboardStatsUsersStats'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { USER_TYPES, UserType } from '@/@types/user/user-type'

function getCollectionsByUserType(
  tenantId: string,
  userType: 'BUSINESS' | 'CONSUMER'
) {
  if (userType === 'CONSUMER') {
    return {
      hourlyCollectionName:
        DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_HOURLY(tenantId),
      dailyCollectionName:
        DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_DAILY(tenantId),
      monthlyCollectionName:
        DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_MONTHLY(tenantId),
    }
  } else {
    return {
      hourlyCollectionName:
        DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_HOURLY(tenantId),
      dailyCollectionName:
        DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_DAILY(tenantId),
      monthlyCollectionName:
        DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_MONTHLY(tenantId),
    }
  }
}

@traceable
export class UserStats {
  public static async refresh(
    tenantId,
    userCreatedTimeRange?: TimeRange
  ): Promise<void> {
    const lastUpdatedAt = Date.now()
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
    })
    const riskClassification =
      await riskRepository.getRiskClassificationValues()

    const db = await getMongoDbClientDb()
    const usersCollection = db.collection<InternalTransaction>(
      USERS_COLLECTION(tenantId)
    )
    for (const userType of USER_TYPES) {
      const {
        hourlyCollectionName,
        dailyCollectionName,
        monthlyCollectionName,
      } = getCollectionsByUserType(tenantId, userType)

      const riskScoreAttributeFieldMapper = {
        $switch: {
          branches: riskClassification.map((item) => ({
            case: {
              $and: [
                {
                  // TODO: Come up with a better way to avoid using the "targetFields" implementation detail
                  $gte: ['$targetFields', item.lowerBoundRiskScore],
                },
                {
                  $lt: ['$targetFields', item.upperBoundRiskScore],
                },
              ],
            },
            then: item.riskLevel,
          })),
          default: 'LOW',
        },
      }

      await usersCollection
        .aggregate(
          withUpdatedAt(
            [
              { $match: { type: userType } },
              ...getAttributeCountStatsPipeline(
                hourlyCollectionName,
                'HOUR',
                'createdTimestamp',
                'krsRiskLevel',
                ['krsScore.krsScore'],
                userCreatedTimeRange,
                { attributeFieldMapper: riskScoreAttributeFieldMapper }
              ),
            ],
            lastUpdatedAt
          ),
          {
            allowDiskUse: true,
          }
        )
        .next()
      await usersCollection
        .aggregate(
          withUpdatedAt(
            [
              { $match: { type: userType } },
              ...getAttributeCountStatsPipeline(
                hourlyCollectionName,
                'HOUR',
                'createdTimestamp',
                'drsRiskLevel',
                ['drsScore.drsScore'],
                userCreatedTimeRange,
                { attributeFieldMapper: riskScoreAttributeFieldMapper }
              ),
            ],
            lastUpdatedAt
          ),
          {
            allowDiskUse: true,
          }
        )
        .next()
      await usersCollection
        .aggregate(
          withUpdatedAt(
            [
              { $match: { type: userType } },
              ...getAttributeCountStatsPipeline(
                hourlyCollectionName,
                'HOUR',
                'createdTimestamp',
                'kycStatus',
                ['kycStatusDetails.status'],
                userCreatedTimeRange
              ),
            ],
            lastUpdatedAt
          ),
          {
            allowDiskUse: true,
          }
        )
        .next()

      await db
        .collection<DashboardStatsUsersStats>(hourlyCollectionName)
        .aggregate(
          withUpdatedAt(
            getAttributeSumStatsDerivedPipeline(
              dailyCollectionName,
              'DAY',
              userCreatedTimeRange
            ),
            lastUpdatedAt
          ),
          {
            allowDiskUse: true,
          }
        )
        .next()

      await db
        .collection<DashboardStatsUsersStats>(dailyCollectionName)
        .aggregate(
          withUpdatedAt(
            getAttributeSumStatsDerivedPipeline(
              monthlyCollectionName,
              'MONTH',
              userCreatedTimeRange
            ),
            lastUpdatedAt
          ),
          {
            allowDiskUse: true,
          }
        )
        .next()

      await Promise.all([
        cleanUpStaleData(
          hourlyCollectionName,
          '_id',
          lastUpdatedAt,
          userCreatedTimeRange,
          'HOUR'
        ),
        cleanUpStaleData(
          dailyCollectionName,
          '_id',
          lastUpdatedAt,
          userCreatedTimeRange,
          'DAY'
        ),
        cleanUpStaleData(
          monthlyCollectionName,
          '_id',
          lastUpdatedAt,
          userCreatedTimeRange,
          'MONTH'
        ),
      ])
    }
  }

  public static async get(
    tenantId: string,
    userType: UserType,
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsUsersStats[]> {
    const db = await getMongoDbClientDb()
    const { hourlyCollectionName, dailyCollectionName, monthlyCollectionName } =
      getCollectionsByUserType(tenantId, userType)

    let collection
    let timeLabels: string[]
    let timeFormat: string

    if (granularity === 'DAY') {
      collection = db.collection<DashboardStatsUsersStats>(dailyCollectionName)
      timeLabels = getTimeLabels(
        DAY_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'DAY'
      )
      timeFormat = DAY_DATE_FORMAT_JS
    } else if (granularity === 'MONTH') {
      collection = db.collection<DashboardStatsUsersStats>(
        monthlyCollectionName
      )
      timeLabels = getTimeLabels(
        MONTH_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'MONTH'
      )
      timeFormat = MONTH_DATE_FORMAT_JS
    } else {
      collection = db.collection<DashboardStatsUsersStats>(hourlyCollectionName)
      timeLabels = getTimeLabels(
        HOUR_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'HOUR'
      )
      timeFormat = HOUR_DATE_FORMAT_JS
    }

    const startDate = dayjs(startTimestamp).format(timeFormat)
    const endDate = dayjs(endTimestamp).format(timeFormat)

    const dashboardStats = await collection
      .find({
        _id: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ _id: 1 })
      .allowDiskUse()
      .toArray()

    const dashboardStatsById = keyBy(dashboardStats, '_id')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        _id: timeLabel,
        ...stat,
      }
    })
  }
}

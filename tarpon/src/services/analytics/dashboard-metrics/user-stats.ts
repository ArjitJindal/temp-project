import { keyBy } from 'lodash'
import { getTimeLabels } from '../../dashboard/utils'
import {
  GranularityValuesType,
  TimeRange,
} from '../../dashboard/repositories/types'
import {
  cleanUpStaleData,
  executeTimeBasedClickhouseQuery,
  getAttributeCountStatsPipeline,
  getAttributeSumStatsDerivedPipeline,
  withUpdatedAt,
} from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
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
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-public-custom/KYCStatus'

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

async function createInexes(tenantId) {
  const db = await getMongoDbClientDb()
  for (const collection of [
    ...Object.values(getCollectionsByUserType(tenantId, 'CONSUMER')),
    ...Object.values(getCollectionsByUserType(tenantId, 'BUSINESS')),
  ]) {
    await db.collection(collection).createIndex(
      {
        time: 1,
        ready: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(collection).createIndex({
      updatedAt: 1,
    })
  }
}

@traceable
export class UserStats {
  public static async refresh(
    tenantId: string,
    userCreatedTimeRange?: TimeRange
  ): Promise<void> {
    await createInexes(tenantId)
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
      await usersCollection
        .aggregate(
          withUpdatedAt(
            [
              { $match: { type: userType } },
              ...getAttributeCountStatsPipeline(
                hourlyCollectionName,
                'HOUR',
                'createdTimestamp',
                'userState',
                ['userStateDetails.state'],
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
      await cleanUpStaleData(
        hourlyCollectionName,
        'time',
        lastUpdatedAt,
        userCreatedTimeRange,
        'HOUR'
      )

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
      await cleanUpStaleData(
        dailyCollectionName,
        'time',
        lastUpdatedAt,
        userCreatedTimeRange,
        'DAY'
      )

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
      await cleanUpStaleData(
        monthlyCollectionName,
        'time',
        lastUpdatedAt,
        userCreatedTimeRange,
        'MONTH'
      )
    }
  }

  private static async getFromClickhouse(
    tenantId: string,
    userType: UserType,
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType = 'HOUR'
  ): Promise<DashboardStatsUsersStats[]> {
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
    })

    const riskClassifications =
      await riskRepository.getRiskClassificationValues()

    const riskClassificationQuery = (type: 'krs' | 'drs') =>
      riskClassifications
        .map(
          (item) =>
            `COUNTIf(${type}Score_${type}Score >= ${item.lowerBoundRiskScore} AND ${type}Score_${type}Score < ${item.upperBoundRiskScore}) AS ${type}RiskLevel_${item.riskLevel}`
        )
        .join(',\n')

    const userStateQuery = USER_STATES.map(
      (item) =>
        `COUNTIf(userStateDetails_state = '${item}') AS userState_${item}`
    ).join(',\n')

    const kycStatusQuery = KYC_STATUSS.map(
      (item) =>
        `COUNTIf(kycStatusDetails_status = '${item}') AS kycStatus_${item}`
    ).join(',\n')

    const data = await executeTimeBasedClickhouseQuery(
      tenantId,
      'users',
      granularity,
      `
      ${riskClassificationQuery('krs')},
      ${riskClassificationQuery('drs')},
      ${userStateQuery},
      ${kycStatusQuery}
    `,
      { startTimestamp, endTimestamp },
      `type = '${userType}'`
    )

    return data
  }

  public static async get(
    tenantId: string,
    userType: UserType,
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType
  ): Promise<DashboardStatsUsersStats[]> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(
        tenantId,
        userType,
        startTimestamp,
        endTimestamp,
        granularity
      )
    }

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
        time: {
          $gte: startDate,
          $lte: endDate,
        },
        ready: { $ne: false },
      })
      .sort({ time: 1 })
      .allowDiskUse()
      .toArray()

    const dashboardStatsById = keyBy(dashboardStats, 'time')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        time: timeLabel,
        ...stat,
      }
    })
  }
}

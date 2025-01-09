import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  getMongoDbClientDb,
  lookupPipelineStage,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsHitsPerUserData } from '@/@types/openapi-internal/DashboardStatsHitsPerUserData'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { traceable } from '@/core/xray'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { getHitsByUserStatsClickhouseQuery } from '@/utils/clickhouse/queries/hits-by-user-stats-clickhouse'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

@traceable
export class HitsByUserStatsDashboardMetric {
  public static async refreshAlertsStats(
    tenantId,
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const userFieldName =
      direction === 'ORIGIN'
        ? 'caseUsers.origin.userId'
        : 'caseUsers.destination.userId'

    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)

    await this.createIndexes(tenantId)

    let alertTimestampMatch: any = {}
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      alertTimestampMatch = {
        'alerts.createdTimestamp': {
          $gte: start,
          $lt: end,
        },
      }
    }

    const mergePipeline = [
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const alertsPipeline = [
      {
        $match: {
          [userFieldName]: { $ne: null },
          ...alertTimestampMatch,
        },
      },
      {
        $unwind: {
          path: '$alerts',
        },
      },
      {
        $match: {
          ...alertTimestampMatch,
          'alerts.alertStatus': {
            $ne: 'CLOSED',
          },
        },
      },
      {
        $project: {
          alerts: 1,
          [userFieldName]: 1,
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$alerts.createdTimestamp',
                  },
                },
              },
            },
            userId: `$${userFieldName}`,
          },
          openAlertsCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          userId: '$_id.userId',
          direction,
          openAlertsCount: '$openAlertsCount',
        },
      },
      ...mergePipeline,
    ]

    const lastUpdatedAt = Date.now()

    // Execute the cases aggregation pipeline
    await casesCollection
      .aggregate(withUpdatedAt(alertsPipeline, lastUpdatedAt), {
        allowDiskUse: true,
      })
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { direction, openAlertsCount: { $exists: true } }
    )
  }

  public static async refreshTransactionsStats(
    tenantId,
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)

    await this.createIndexes(tenantId)

    let tranasctionTimestampMatch: any = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      tranasctionTimestampMatch = {
        timestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }

    const mergePipeline = [
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const transactionsPipeline = [
      {
        $match: {
          ...tranasctionTimestampMatch,
          [`${direction.toLowerCase()}UserId`]: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$timestamp',
                  },
                },
              },
            },
            userId: `$${direction.toLowerCase()}UserId`,
          },
          rulesHitCount: {
            $sum: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$hitRules', []] },
                  as: 'hitRule',
                  cond: {
                    $ne: ['$$hitRule.isShadow', true],
                  },
                },
              },
            },
          },
          rulesRunCount: {
            $sum: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$executedRules', []] },
                  as: 'executedRule',
                  cond: {
                    $ne: ['$$executedRule.isShadow', true],
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          userId: '$_id.userId',
          direction,
          rulesHitCount: '$rulesHitCount',
          rulesRunCount: '$rulesRunCount',
        },
      },
      ...mergePipeline,
    ]

    const lastUpdatedAt = Date.now()

    // Execute the transactions aggregation pipeline
    await transactionsCollection
      .aggregate(withUpdatedAt(transactionsPipeline, lastUpdatedAt), {
        allowDiskUse: true,
      })
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { direction, rulesRunCount: { $exists: true } }
    )
  }

  private static async createIndexes(tenantId: string) {
    const db = await getMongoDbClientDb()
    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)

    await db.collection(aggregationCollection).createIndex(
      {
        direction: 1,
        date: -1,
        userId: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(aggregationCollection).createIndex({
      direction: 1,
      updatedAt: 1,
      date: 1,
    })
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION',
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<DashboardStatsHitsPerUserData[]> {
    if (isClickhouseEnabled()) {
      return this.getClickhouse(
        tenantId,
        startTimestamp,
        endTimestamp,
        direction,
        userType
      )
    }
    const db = await getMongoDbClientDb()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
    )
    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    const condition = {
      $match: {
        ...(direction ? { direction } : { direction: { $exists: true } }),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    }

    const userTypeCondition = {
      $match: {
        'user.type': userType,
      },
    }

    const result = await collection
      .aggregate<{
        _id: string
        user: InternalConsumerUser | InternalBusinessUser | null
        openAlertsCount: number
        rulesRunCount: number
        rulesHitCount: number
      }>(
        [
          {
            $match: {
              ...condition.$match,
            },
          },
          {
            $group: {
              _id: `$userId`,
              openAlertsCount: { $sum: '$openAlertsCount' },
              rulesRunCount: { $sum: '$rulesRunCount' },
              rulesHitCount: { $sum: '$rulesHitCount' },
            },
          },
          {
            $match: {
              rulesHitCount: { $gt: 0 },
              rulesRunCount: { $gt: 0 },
            },
          },
          {
            $sort: { rulesHitCount: -1 },
          },
          lookupPipelineStage(
            {
              from: USERS_COLLECTION(tenantId),
              localField: '_id',
              foreignField: 'userId',
              as: 'user',
            },
            true
          ),
          userTypeCondition,
          {
            $set: {
              user: { $first: '$user' },
            },
          },
          {
            $limit: 10,
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => {
      const formatConsumerName = (name: any): string => {
        const result = [name?.firstName, name?.middleName, name?.lastName]
          .filter(Boolean)
          .join(' ')
        if (result === '') {
          return '(No name)'
        }
        return result
      }

      const userName =
        x.user?.type === 'BUSINESS'
          ? x.user?.legalEntity?.companyGeneralDetails?.legalName ?? '-'
          : formatConsumerName(x.user?.userDetails?.name) ?? '-'

      return {
        userId: x._id,
        userName,
        userType: x.user?.type,
        rulesHitCount: x.rulesHitCount,
        openAlertsCount: x.openAlertsCount,
        rulesRunCount: x.rulesRunCount,
      }
    })
  }

  private static async getClickhouse(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION',
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<DashboardStatsHitsPerUserData[]> {
    const clickhouse = await getClickhouseClient(tenantId)
    const directions = direction ? [direction] : ['ORIGIN', 'DESTINATION']
    const queries = directions.map((dir) => {
      return getHitsByUserStatsClickhouseQuery(
        startTimestamp,
        endTimestamp,
        dir
      )
    })
    let processedQuery = ''
    if (queries.length > 1) {
      processedQuery = `
        WITH originQuery AS (${queries[0]}), 
        destinationQuery AS (${queries[1]})
        select
            coalesce(NULLIF(a.date, ''), NULLIF(t.date, '')) as date,
            coalesce(NULLIF(a.userId, ''), NULLIF(t.userId, '')) as userId,
            coalesce(NULLIF(a.direction, ''), NULLIF(t.direction, '')) as direction,
            coalesce(NULLIF(a.openAlertsCount, 0), NULLIF(t.openAlertsCount, 0), 0) as openAlertsCount,
            coalesce(NULLIF(a.rulesHitCount, 0), NULLIF(t.rulesHitCount, 0), 0) as rulesHitCount,
            coalesce(NULLIF(a.rulesRunCount, 0), NULLIF(t.rulesRunCount, 0), 0) as rulesRunCount

        from originQuery as a
        full outer join destinationQuery as t
        on a.date = t.date
        and a.userId = t.userId
        and a.direction = t.direction
      `
    } else {
      processedQuery = queries[0]
    }
    const finalQuery = `
      WITH base_data as (${processedQuery}),
      aggregated_data AS (
        SELECT 
          userId,
          sum(openAlertsCount) as openAlertsCount,
          sum(rulesRunCount) as rulesRunCount,
          sum(rulesHitCount) as rulesHitCount
        FROM base_data
        ${direction ? `WHERE direction = '${direction}'` : ''}
        GROUP BY userId
        HAVING rulesHitCount > 0 AND rulesRunCount > 0
      ),
      user_data AS (
        SELECT 
          id,
          username as userName,
          type as userType
        FROM ${CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table}
        WHERE id in (SELECT userId FROM aggregated_data)
        ${userType ? `AND type = '${userType}'` : ''}
      ),
      user_joined AS (
        SELECT 
          a.*,
          u.userName,
          u.userType
        FROM aggregated_data a
        JOIN user_data u ON a.userId = u.id
      )
      SELECT 
        userId,
        any(userName) as userName,
        any(userType) as userType,
        any(openAlertsCount) as openAlertsCount,
        any(rulesRunCount) as rulesRunCount,
        any(rulesHitCount) as rulesHitCount
      FROM user_joined
      group by userId
      ORDER BY rulesHitCount DESC
      LIMIT 10
    `
    const result = await clickhouse.query({
      query: finalQuery,
      format: 'JSONEachRow',
    })
    const items = await result.json<{
      userId: string
      userName: string
      userType: string
      openAlertsCount: number
      rulesRunCount: number
      rulesHitCount: number
    }>()

    return items.map((item) => {
      return {
        userId: item.userId,
        userName: item.userName,
        userType: item.userType,
        rulesHitCount: Number(item.rulesHitCount),
        openAlertsCount: Number(item.openAlertsCount),
        rulesRunCount: Number(item.rulesRunCount),
      }
    })
  }
}

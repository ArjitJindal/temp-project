import { getAffectedInterval } from '../../dashboard/utils'
import {
  DashboardStatsRiskLevelDistributionData,
  TimeRange,
} from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb, paginatePipeline } from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsRulesCountResponse } from '@/@types/openapi-internal/DashboardStatsRulesCountResponse'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { DashboardStatsRulesCount } from '@/@types/openapi-internal/DashboardStatsRulesCount'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

function getRuleStatsConditions(startDateText: string, endDateText: string) {
  return [
    {
      $match: {
        date: {
          $gte: startDateText,
          $lte: endDateText,
        },
      },
    },
    {
      $group: {
        _id: {
          ruleId: '$ruleId',
          ruleInstanceId: '$ruleInstanceId',
        },
        hitCount: { $sum: '$hitCount' },
        openAlertsCount: { $sum: '$openAlertsCount' },
        runCount: { $sum: '$runCount' },
      },
    },
  ]
}

@traceable
export class RuleHitsStatsDashboardMetric {
  public static async refreshAlertsStats(
    tenantId,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    await this.createIndexes(tenantId)
    let timestampMatch: any = undefined

    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        'alerts.createdTimestamp': {
          $gte: start,
          $lt: end,
        },
      }
    }

    const pipeline = [
      {
        $match: { ...timestampMatch },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: { ...timestampMatch },
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
            ruleId: '$alerts.ruleId',
            ruleInstanceId: '$alerts.ruleInstanceId',
          },
          ruleHitCount: {
            $sum: 0,
          },
          openAlertsCount: {
            $sum: {
              $cond: {
                if: { $ne: ['$alerts.alertStatus', 'CLOSED'] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          ruleId: '$_id.ruleId',
          ruleInstanceId: '$_id.ruleInstanceId',
          hitCount: '$rulesHitCount',
          openAlertsCount: '$openAlertsCount',
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          on: ['date', 'ruleId', 'ruleInstanceId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const lastUpdatedAt = Date.now()
    await casesCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { openAlertsCount: { $exists: true } }
    )
  }

  public static async refreshTransactionsStats(
    tenantId,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    await this.createIndexes(tenantId)
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

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
          on: ['date', 'ruleId', 'ruleInstanceId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const transactionsPipeline = [
      {
        $match: {
          ...tranasctionTimestampMatch,
        },
      },
      {
        $unwind: { path: '$hitRules' },
      },
      {
        $match: {
          'hitRules.ruleId': { $exists: true },
          'hitRules.ruleInstanceId': { $exists: true },
          'hitRules.isShadow': { $ne: true },
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
            ruleId: '$hitRules.ruleId',
            ruleInstanceId: '$hitRules.ruleInstanceId',
          },
          rulesHitCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          ruleId: '$_id.ruleId',
          ruleInstanceId: '$_id.ruleInstanceId',
          hitCount: '$rulesHitCount',
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
      { hitCount: { $exists: true } }
    )
  }
  // Aggregate and store run counts per rule from transactions and users collections.
  public static async refreshRuleRunCount(
    tenantId,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const transactions = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const users = db.collection<any>(USERS_COLLECTION(tenantId))
    await this.createIndexes(tenantId)
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

    const getTimestampMatch = (
      fieldName: string,
      range?: TimeRange
    ): Record<string, any> | undefined => {
      if (!range) {
        return undefined
      }
      const { start, end } = getAffectedInterval(range, 'HOUR')
      return {
        [fieldName]: {
          $gte: start,
          $lt: end,
        },
      }
    }

    const transactionTimestampMatch = getTimestampMatch('timestamp', timeRange)
    const userTimestampMatch = getTimestampMatch('createdTimestamp', timeRange)

    const mergePipeline = [
      {
        $merge: {
          into: aggregationCollection,
          on: ['date', 'ruleId', 'ruleInstanceId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const buildPipeline = (
      timestampMatch?: Record<string, any>,
      fieldName: string = 'timestamp'
    ) => [
      {
        $match: {
          ...timestampMatch,
        },
      },
      {
        $unwind: { path: '$executedRules' },
      },
      {
        $match: {
          'executedRules.ruleId': { $exists: true },
          'executedRules.ruleInstanceId': { $exists: true },
          'executedRules.isShadow': { $ne: true },
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
                    $toLong: `$${fieldName}`,
                  },
                },
              },
            },
            ruleId: '$executedRules.ruleId',
            ruleInstanceId: '$executedRules.ruleInstanceId',
          },
          rulesRunCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          ruleId: '$_id.ruleId',
          ruleInstanceId: '$_id.ruleInstanceId',
          runCount: '$rulesRunCount',
        },
      },
      ...mergePipeline,
    ]

    const lastUpdatedAt = Date.now()

    await transactions
      .aggregate(
        withUpdatedAt(
          buildPipeline(transactionTimestampMatch, 'timestamp'),
          lastUpdatedAt
        ),
        {
          allowDiskUse: true,
        }
      )
      .next()

    await users
      .aggregate(
        withUpdatedAt(
          buildPipeline(userTimestampMatch, 'createdTimestamp'),
          lastUpdatedAt
        ),
        {
          allowDiskUse: true,
        }
      )
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { runCount: { $exists: true } }
    )
  }

  private static async createIndexes(tenantId: string) {
    const db = await getMongoDbClientDb()
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

    await db.collection(aggregationCollection).createIndex(
      {
        ruleId: 1,
        date: -1,
        ruleInstanceId: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(aggregationCollection).createIndex({
      updatedAt: 1,
      date: 1,
    })
    await db.collection(aggregationCollection).createIndex({
      date: -1,
    })
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    ruleInstances: RuleInstance[],
    pageSize?: number | 'DISABLED',
    page?: number
  ): Promise<DashboardStatsRulesCountResponse> {
    const allRules = ruleInstances.map(({ id, ruleId }) => ({
      id: id as string,
      ruleId: ruleId as string,
    }))
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(
        tenantId,
        startTimestamp,
        endTimestamp,
        allRules,
        pageSize,
        page
      )
    }

    const db = await getMongoDbClientDb()
    const collection = db.collection<DashboardStatsRiskLevelDistributionData>(
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    )
    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const [result] = await collection
      .aggregate<{
        paginatedData: {
          _id: { ruleId: string; ruleInstanceId: string }
          hitCount: number
          openAlertsCount: number
          runCount: number
        }[]
        totalCount: { count: number }[]
      }>(
        [
          ...getRuleStatsConditions(startDateText, endDateText),
          {
            $facet: {
              paginatedData: [
                { $sort: { hitCount: -1 } },
                ...paginatePipeline({ page, pageSize }),
              ],
              totalCount: [{ $count: 'count' }],
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return {
      data: result.paginatedData.map((x) => ({
        ruleId: x._id.ruleId,
        ruleInstanceId: x._id.ruleInstanceId,
        hitCount: x.hitCount,
        openAlertsCount: x.openAlertsCount,
        runCount: x.runCount,
      })),
      total: result.totalCount[0]?.count ?? 0,
    }
  }

  private static async getFromClickhouse(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    allRules: Array<{ id: string; ruleId: string }>,
    pageSize?: number | 'DISABLED',
    page?: number
  ): Promise<DashboardStatsRulesCountResponse> {
    const client = await getClickhouseClient(tenantId)
    const offset =
      page && pageSize !== 'DISABLED'
        ? (page - 1) * (pageSize ?? DEFAULT_PAGE_SIZE)
        : 0

    const finalQuery = `
      SELECT
        ruleId,
        ruleInstanceId,
        hitCount,
        openAlertsCount,
        runCount,
        if(runCount > 0, hitCount / runCount, 0) as hitRate,
  count() OVER() as totalCount
      FROM (
        SELECT
          ruleId,
          ruleInstanceId,
          sum(hitCount) as hitCount,
          sum(openAlertsCount) as openAlertsCount,
          sum(runCount) as runCount
        FROM (
          -- Transaction event rule hits
          SELECT 
            rule.1 AS ruleInstanceId,
            rule.2 AS ruleId,
            count() as hitCount,
            0 as openAlertsCount,
            0 as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          ARRAY JOIN nonShadowHitRuleIdPairs AS rule
          WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
            AND rule.1 != '' AND rule.2 != ''
          GROUP BY rule.1, rule.2
          
          UNION ALL
          -- user event rule hits
          SELECT 
            rule.1 AS ruleInstanceId,
            rule.2 AS ruleId,
            count() as hitCount,
            0 as openAlertsCount,
            0 as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
          ARRAY JOIN nonShadowHitRuleIdPairs AS rule
          WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
            AND rule.1 != '' AND rule.2 != ''
          GROUP BY rule.1, rule.2
          
          UNION ALL

          -- Transaction event rule executions
          SELECT 
            rule.1 AS ruleInstanceId,
            rule.2 AS ruleId,
            0 as hitCount,
            0 as openAlertsCount,
            count() as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          ARRAY JOIN nonShadowExecutedRuleIdPairs AS rule
          WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
            AND rule.1 != '' AND rule.2 != ''
          GROUP BY rule.1, rule.2
          
          UNION ALL
          

          -- User event rule executions
          SELECT 
            rule.1 AS ruleInstanceId,
            rule.2 AS ruleId,
            0 as hitCount,
            0 as openAlertsCount,
            count() as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
          ARRAY JOIN nonShadowExecutedRuleIdPairs AS rule
          WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
            AND rule.1 != '' AND rule.2 != ''
          GROUP BY rule.1, rule.2
          UNION ALL
          

          -- Alert data
          SELECT
            alert.ruleInstanceId,
            alert.ruleId,
            0 as hitCount,
            countIf(alert.alertStatus != 'CLOSED') as openAlertsCount,
            0 as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
          ARRAY JOIN alerts AS alert
          WHERE alert.createdTimestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
            AND alert.ruleInstanceId != ''
            AND alert.ruleId != ''
          GROUP BY alert.ruleInstanceId, alert.ruleId
        )
        WHERE ruleInstanceId != '' AND ruleId != ''
        GROUP BY ruleId, ruleInstanceId
      )
      ORDER BY hitCount DESC
    `
    const items = await executeClickhouseQuery<Array<DashboardStatsRulesCount>>(
      client,
      {
        query: finalQuery,
        format: 'JSONEachRow',
      }
    )
    const existingDataMap = new Map<
      string,
      {
        ruleId: string
        ruleInstanceId: string
        hitCount: number
        openAlertsCount: number
        runCount: number
      }
    >()

    items.forEach((item) => {
      if (item.ruleId && item.ruleInstanceId) {
        const key = `${item.ruleId}-${item.ruleInstanceId}`
        existingDataMap.set(key, {
          ruleId: item.ruleId,
          ruleInstanceId: item.ruleInstanceId,
          hitCount: Number(item.hitCount ?? 0),
          openAlertsCount: Number(item.openAlertsCount ?? 0),
          runCount: Number(item.runCount ?? 0),
        })
      }
    })

    const allRuleData =
      allRules?.map(({ id, ruleId }) => {
        const key = `${ruleId}-${id}`
        const existingData = existingDataMap.get(key)
        return (
          existingData || {
            ruleId,
            ruleInstanceId: id,
            hitCount: 0,
            openAlertsCount: 0,
            runCount: 0,
          }
        )
      }) || []

    allRuleData.sort((a, b) => b.hitCount - a.hitCount)
    const total = allRuleData.length
    let paginatedData = allRuleData

    if (pageSize !== 'DISABLED') {
      const limit = pageSize ?? DEFAULT_PAGE_SIZE
      paginatedData = allRuleData.slice(offset, offset + limit)
    }

    return {
      data: paginatedData,
      total,
    }
  }
}

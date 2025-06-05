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
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsRulesCountResponse } from '@/@types/openapi-internal/DashboardStatsRulesCountResponse'
import {
  getClickhouseClient,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { DashboardStatsRulesCount } from '@/@types/openapi-internal/DashboardStatsRulesCount'

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
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.numberOfTransactionsHit', 0] },
                then: 1,
                else: 0,
              },
            },
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

    const buildPipeline = (timestampMatch?: Record<string, any>) => [
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
                    $toLong: '$timestamp',
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
        withUpdatedAt(buildPipeline(transactionTimestampMatch), lastUpdatedAt),
        {
          allowDiskUse: true,
        }
      )
      .next()

    await users
      .aggregate(
        withUpdatedAt(buildPipeline(userTimestampMatch), lastUpdatedAt),
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
    pageSize?: number | 'DISABLED',
    page?: number
  ): Promise<DashboardStatsRulesCountResponse> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(
        tenantId,
        startTimestamp,
        endTimestamp,
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
    pageSize?: number | 'DISABLED',
    page?: number
  ): Promise<DashboardStatsRulesCountResponse> {
    const client = await getClickhouseClient(tenantId)
    const limit =
      pageSize === 'DISABLED' ? 'NULL' : pageSize ?? DEFAULT_PAGE_SIZE
    const offset =
      page && pageSize !== 'DISABLED'
        ? (page - 1) * (pageSize ?? DEFAULT_PAGE_SIZE)
        : 0

    // compiling the data as we do in the refreshstats above for mongo. Doing it once for clickhouse without storing the
    // data in a new table

    const transactionsQuery = `

    SELECT
      arrayJoin(nonShadowHitRuleIdPairs).1 AS ruleInstanceId,
      arrayJoin(nonShadowHitRuleIdPairs).2 AS ruleId,
      count() as hitCount
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    WHERE timestamp BETWEEN '${startTimestamp}' AND '${endTimestamp}'
    GROUP BY ruleInstanceId, ruleId
  `

    const transactionExecutedRulesQuery = `
    SELECT
      tupleElement(ruleTuple, 1) AS ruleInstanceId,
      tupleElement(ruleTuple, 2) AS ruleId,
      count() as executedCount
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    ARRAY JOIN nonShadowExecutedRuleIdPairs AS ruleTuple
    WHERE timestamp BETWEEN '${startTimestamp}' AND '${endTimestamp}'
    GROUP BY ruleInstanceId, ruleId

    `
    const userExecutedRulesQuery = `
    SELECT
      tupleElement(ruleTuple, 1) AS ruleInstanceId,
      tupleElement(ruleTuple, 2) AS ruleId,
      count() as executedCount
    FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
    ARRAY JOIN nonShadowExecutedRuleIdPairs AS ruleTuple
    WHERE timestamp BETWEEN '${startTimestamp}' AND '${endTimestamp}'
    GROUP BY ruleInstanceId, ruleId
    `

    const alertsQuery = `
    WITH
      arrayJoin(alerts) as alert
    SELECT
      alert.ruleInstanceId as ruleInstanceId,
      alert.ruleId as ruleId,
      countIf(alert.alertStatus != 'CLOSED') as openAlertsCount,
      countIf(alert.numberOfTransactionsHit = 0) as hitCount
    FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    WHERE alert.createdTimestamp BETWEEN '${startTimestamp}' AND '${endTimestamp}'
    GROUP BY ruleInstanceId, ruleId
  `

    const finalQuery = `
      WITH
        txn AS (${transactionsQuery}),
        alerts_ct AS (${alertsQuery}),
        transactionExecutedRules AS (${transactionExecutedRulesQuery}),
        userExecutedRules AS (${userExecutedRulesQuery}),
        combined AS (
          SELECT
            coalesce(NULLIF(t.ruleId, ''), NULLIF(a.ruleId, '')) as ruleId,
            coalesce(NULLIF(t.ruleInstanceId, ''), NULLIF(a.ruleInstanceId, '')) as ruleInstanceId,
            coalesce(t.hitCount, 0) + coalesce(a.hitCount, 0) as hitCount,
            coalesce(a.openAlertsCount, 0) as openAlertsCount,
            coalesce(tra.executedCount, 0) + coalesce(user.executedCount, 0) as runCount
          FROM txn t
          FULL OUTER JOIN alerts_ct a ON t.ruleInstanceId = a.ruleInstanceId AND t.ruleId = a.ruleId
          FULL OUTER JOIN transactionExecutedRules tra ON t.ruleInstanceId = tra.ruleInstanceId AND t.ruleId = tra.ruleId
          FULL OUTER JOIN userExecutedRules user ON a.ruleInstanceId = user.ruleInstanceId AND a.ruleId = user.ruleId

        ),
        total_count AS (
          SELECT count(*) as total FROM combined
        )
      SELECT
        ruleId,
        ruleInstanceId,
        hitCount,
        openAlertsCount,
        runCount,
        (SELECT total FROM total_count) as totalCount
      FROM combined
      ORDER BY hitCount DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const items = await executeClickhouseQuery<
      Array<DashboardStatsRulesCount & { totalCount: number }>
    >(client, {
      query: finalQuery,
      format: 'JSONEachRow',
    })

    return {
      data: items.map((item) => ({
        ruleId: item.ruleId,
        ruleInstanceId: item.ruleInstanceId,
        hitCount: Number(item.hitCount ?? 0),
        openAlertsCount: Number(item.openAlertsCount ?? 0),
        runCount: Number(item.runCount ?? 0),
      })),
      total: Number(items[0]?.totalCount ?? 0),
    }
  }
}

import { getAffectedInterval } from '../../dashboard/utils'
import {
  DashboardStatsRiskLevelDistributionData,
  TimeRange,
} from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  getMongoDbClientDb,
  paginatePipeline,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsRulesCountResponse } from '@/@types/openapi-internal/DashboardStatsRulesCountResponse'
import {
  getClickhouseClient,
  isClickhouseEnabled,
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
    WITH
      arrayJoin(ruleInstancesHit) as ruleInstanceId,
      JSONExtractString(data, 'hitRules') as hitRules
    SELECT 
      ruleInstanceId,
      JSONExtractString(arrayFirst(x -> JSONExtractString(x, 'ruleInstanceId') = ruleInstanceId, JSONExtractArrayRaw(data, 'hitRules')), 'ruleId') as ruleId,
      count() as hitCount
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName}
    WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
      AND JSONExtractBool(arrayFirst(x -> JSONExtractString(x, 'ruleInstanceId') = ruleInstanceId, JSONExtractArrayRaw(data, 'hitRules')), 'isShadow') != true
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
  FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
  WHERE timestamp BETWEEN ${startTimestamp} AND ${endTimestamp}
  GROUP BY ruleInstanceId, ruleId
  `

    const finalQuery = `
  WITH 
    transactions AS (${transactionsQuery}),
    alerts AS (${alertsQuery})
  SELECT 
    if(t.ruleId != '', t.ruleId, a.ruleId) as ruleId,
    if(t.ruleInstanceId != '', t.ruleInstanceId, a.ruleInstanceId) as ruleInstanceId,
    coalesce(t.hitCount, 0) + coalesce(a.hitCount, 0) as hitCount,
    a.openAlertsCount
  FROM transactions t
  FULL OUTER JOIN alerts a ON t.ruleInstanceId = a.ruleInstanceId
  ORDER BY hitCount DESC
  LIMIT ${limit}
  OFFSET ${offset}
  SETTINGS join_use_nulls = 1, output_format_json_quote_64bit_integers = 0
`

    const countQuery = `
    WITH 
      transactions AS (${transactionsQuery}),
      alerts AS (${alertsQuery})
    SELECT count() as total
    FROM (
      SELECT ruleInstanceId
      FROM transactions
      UNION DISTINCT
      SELECT ruleInstanceId
      FROM alerts
      WHERE ruleInstanceId != ''
    )
  `

    const [data, totalCount] = await Promise.all([
      client
        .query({
          query: finalQuery,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<DashboardStatsRulesCount>()),
      client
        .query({
          query: countQuery,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ total: number }>()),
    ])

    return {
      data: data.map((row) => ({
        ruleId: row.ruleId,
        ruleInstanceId: row.ruleInstanceId,
        hitCount: Number(row.hitCount ?? 0),
        openAlertsCount: Number(row.openAlertsCount ?? 0),
      })),
      total: Number(totalCount[0]?.total ?? 0),
    }
  }
}

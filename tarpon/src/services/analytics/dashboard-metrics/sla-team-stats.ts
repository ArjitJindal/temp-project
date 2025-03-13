import { cleanUpStaleData, withUpdatedAt } from './utils'
import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { getAffectedInterval } from '@/services/dashboard/utils'
import {
  CASES_COLLECTION,
  DASHBOARD_SLA_TEAM_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import {
  getMongoDbClientDb,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  paginatePipeline,
} from '@/utils/mongodb-utils'
import {
  DashboardStatsTeamSLAItem,
  DashboardStatsTeamSLAItemResponse,
} from '@/@types/openapi-internal/all'
import dayjs from '@/utils/dayjs'
import {
  getClickhouseClient,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'

@traceable
export class TeamSLAStatsDashboardMetric {
  public static async refresh(tenantId: string, timeRange?: TimeRange) {
    const db = await getMongoDbClientDb()
    const collection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection = DASHBOARD_SLA_TEAM_STATS_HOURLY(tenantId)
    const lastUpdatedAt = Date.now()
    let timestampMatch: any = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        'alerts.lastStatusChange.timestamp': {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      {
        $match: {
          alerts: { $elemMatch: { alertStatus: 'CLOSED' } },
          ...timestampMatch,
        },
      },
      { $unwind: '$alerts' },
      {
        $match: {
          'alerts.alertStatus': 'CLOSED',
          'alerts.slaPolicyDetails': { $ne: null },
          'alerts.assignments.0': { $exists: true },
          ...timestampMatch,
        },
      },
      { $unwind: '$alerts.assignments' },
      { $unwind: '$alerts.slaPolicyDetails' },
      {
        $project: {
          account: '$alerts.assignments.assigneeUserId',
          slaPolicyDetail: '$alerts.slaPolicyDetails',
          time: {
            $dateToString: {
              format: HOUR_DATE_FORMAT,
              date: {
                $toDate: { $toLong: '$alerts.lastStatusChange.timestamp' },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: { accountId: '$account', time: '$time' },
          OK: {
            $sum: {
              $cond: [{ $eq: ['$slaPolicyDetail.policyStatus', 'OK'] }, 1, 0],
            },
          },
          BREACHED: {
            $sum: {
              $cond: [
                { $eq: ['$slaPolicyDetail.policyStatus', 'BREACHED'] },
                1,
                0,
              ],
            },
          },
          WARNING: {
            $sum: {
              $cond: [
                { $eq: ['$slaPolicyDetail.policyStatus', 'WARNING'] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.time',
          slaStats: {
            $push: {
              accountId: '$_id.accountId',
              WARNING: '$WARNING',
              BREACHED: '$BREACHED',
              OK: '$OK',
            },
          },
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          whenMatched: 'merge',
        },
      },
    ]
    await collection.aggregate(withUpdatedAt(pipeline, lastUpdatedAt)).next()
    await cleanUpStaleData(
      aggregationCollection,
      '_id',
      lastUpdatedAt,
      timeRange,
      'HOUR'
    )
  }
  public static async get(
    tenantId: string,
    timeRange?: TimeRange,
    pageSize?: number,
    page?: number
  ): Promise<DashboardStatsTeamSLAItemResponse> {
    if (isClickhouseEnabled()) {
      return await this.getClickhouse(tenantId, timeRange, pageSize, page)
    }
    const db = await getMongoDbClientDb()
    const collection = db.collection(DASHBOARD_SLA_TEAM_STATS_HOURLY(tenantId))
    const { startTimestamp, endTimestamp } = timeRange || {}
    let dateCondition: Record<string, unknown> | null = null
    if (startTimestamp != null || endTimestamp != null) {
      dateCondition = {}
      if (startTimestamp != null) {
        dateCondition['$gte'] =
          dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
      if (endTimestamp != null) {
        dateCondition['$lte'] = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
    }

    const basePipeline = [
      ...(Object.keys(dateCondition || {}).length > 0
        ? [
            {
              $match: {
                _id: dateCondition,
              },
            },
          ]
        : []),
      {
        $unwind: '$slaStats',
      },
      {
        $group: {
          _id: {
            accountId: '$slaStats.accountId',
          },
          WARNING: {
            $sum: '$slaStats.WARNING',
          },
          BREACHED: {
            $sum: '$slaStats.BREACHED',
          },
          OK: {
            $sum: '$slaStats.OK',
          },
        },
      },
    ]

    const totalPipeline = [...basePipeline, { $count: 'total' }]
    const totalResult = await collection
      .aggregate<{ total: number }>(totalPipeline, { allowDiskUse: true })
      .toArray()
    const total = totalResult[0]?.total || 0

    const paginationPipeline = paginatePipeline({
      page: page,
      pageSize: pageSize,
    })

    const paginatedPipeline = [
      ...basePipeline,
      { $sort: { '_id.accountId': 1 } },
      ...paginationPipeline,
    ]
    const result = await collection
      .aggregate<{
        _id: { accountId: string }
        WARNING: number
        BREACHED: number
        OK: number
      }>(paginatedPipeline, { allowDiskUse: true })
      .toArray()
    const items = result.map((r) => ({
      accountId: r._id.accountId,
      WARNING: r.WARNING,
      BREACHED: r.BREACHED,
      OK: r.OK,
    }))

    return {
      items,
      total,
    }
  }

  private static async getClickhouse(
    tenantId: string,
    timeRange?: TimeRange,
    pageSize?: number,
    page?: number
  ): Promise<DashboardStatsTeamSLAItemResponse> {
    const clickhouseClient = await getClickhouseClient(tenantId)
    const { startTimestamp, endTimestamp } = timeRange || {}
    const timeRangeCondition: string[] = []
    if (startTimestamp != null) {
      timeRangeCondition.push(
        `alerts.lastStatusChangeTimestamp >= ${startTimestamp}`
      )
    }
    if (endTimestamp != null) {
      timeRangeCondition.push(
        `alerts.lastStatusChangeTimestamp <= ${endTimestamp}`
      )
    }

    const query = `
    WITH grouped_data AS (
      SELECT
          assignment.assigneeUserId AS accountId,
          countIf(sla.policyStatus = 'OK') AS OK,
          countIf(sla.policyStatus = 'BREACHED') AS BREACHED,
          countIf(sla.policyStatus = 'WARNING') AS WARNING
      FROM cases
      ARRAY JOIN alerts AS alerts
      ARRAY JOIN alerts.assignments AS assignment
      ARRAY JOIN alerts.slaPolicyDetails AS sla
      WHERE (alerts.alertStatus = 'CLOSED') 
      AND (length(alerts.slaPolicyDetails) > 0) 
      AND (length(alerts.assignments) > 0)
      ${
        timeRangeCondition.length > 0
          ? `AND (${timeRangeCondition.join(' AND ')})`
          : ''
      }
      GROUP BY accountId
    )
    SELECT 
    accountId,
    OK,
    BREACHED,
    WARNING,
    (SELECT count(*) FROM grouped_data) AS total
    FROM grouped_data
    ORDER BY account ASC
    ${
      pageSize ? `LIMIT ${pageSize} OFFSET ${((page || 1) - 1) * pageSize}` : ''
    }
    `

    const items = await executeClickhouseQuery<
      Array<DashboardStatsTeamSLAItem & { total: number }>
    >(clickhouseClient, {
      query,
      format: 'JSONEachRow',
    })

    return {
      items: items.map((item) => ({
        accountId: item.accountId,
        OK: Number(item.OK),
        BREACHED: Number(item.BREACHED),
        WARNING: Number(item.WARNING),
      })),
      total: Number(items[0]?.total || 0),
    }
  }
}

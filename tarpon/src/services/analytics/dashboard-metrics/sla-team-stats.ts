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
} from '@/utils/mongodb-utils'
import { DashboardStatsTeamSLAItem } from '@/@types/openapi-internal/DashboardStatsTeamSLAItem'
import dayjs from '@/utils/dayjs'

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
    timeRange?: TimeRange
  ): Promise<DashboardStatsTeamSLAItem[]> {
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

    const pipeline = [
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
    const result = await collection
      .aggregate<{
        _id: { accountId: string }
        WARNING: number
        BREACHED: number
        OK: number
      }>(pipeline, { allowDiskUse: true })
      .toArray()
    return result.map((r) => ({
      accountId: r._id.accountId,
      WARNING: r.WARNING,
      BREACHED: r.BREACHED,
      OK: r.OK,
    }))
  }
}

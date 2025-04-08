import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  DASHBOARD_QA_OVERVIEW_STATS_COLLECTION_HOURLY,
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { DashboardStatsQaOverview } from '@/@types/openapi-internal/DashboardStatsQaOverview'
import {
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

@traceable
export class QaOverviewStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_QA_OVERVIEW_STATS_COLLECTION_HOURLY(tenantId)
    let timestampMatch: any = undefined

    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        'alerts.updatedAt': {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      {
        $match: {
          'alerts.alertStatus': 'CLOSED',
          ...timestampMatch,
        },
      },
      {
        $unwind: {
          path: '$alerts',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'alerts.alertStatus': 'CLOSED',
          'alerts.qaAssignment': { $exists: true, $ne: [] },
          ...timestampMatch,
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$alerts.updatedAt',
                  },
                },
              },
            },
          },
          totalAlertsForQa: {
            $sum: 1,
          },
          totalQaPassedAlerts: {
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.ruleQaStatus', 'PASSED'] },
                then: 1,
                else: 0,
              },
            },
          },
          totalQaFailedAlerts: {
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.ruleQaStatus', 'FAILED'] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: '$_id.time',
          totalAlertsForQa: '$totalAlertsForQa',
          totalQaPassedAlerts: '$totalQaPassedAlerts',
          totalQaFailedAlerts: '$totalQaFailedAlerts',
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
    await casesCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      '_id',
      lastUpdatedAt,
      timeRange,
      'HOUR'
    )
  }
  public static async getFromClickhouse(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaOverview> {
    const query = `
    SELECT
        count(*) AS totalAlertsForQa,
        countIf(alerts.ruleQaStatus = 'PASSED') AS totalQaPassedAlerts,
        countIf(alerts.ruleQaStatus = 'FAILED') AS totalQaFailedAlerts
    FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    ARRAY JOIN alerts
    WHERE alerts.alertStatus = 'CLOSED'
        AND arrayExists(x -> coalesce(x.assigneeUserId, '') != '', alerts.qaAssignments)
        AND toDateTime(alerts.updatedAt / 1000)
            BETWEEN toDateTime(${startTimestamp / 1000}) AND toDateTime(${
      endTimestamp / 1000
    })
    `

    const data = await executeClickhouseQuery<DashboardStatsQaOverview>(
      tenantId,
      query
    )
    return data[0]
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaOverview> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(tenantId, startTimestamp, endTimestamp)
    }
    const db = await getMongoDbClientDb()
    const collection = db.collection(
      DASHBOARD_QA_OVERVIEW_STATS_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        totalAlertsForQa: number
        totalQaPassedAlerts: number
        totalQaFailedAlerts: number
      }>(
        [
          {
            $match: {
              _id: {
                $gt: startDateText,
                $lte: endDateText,
              },
            },
          },
          {
            $group: {
              _id: null,
              totalAlertsForQa: { $sum: '$totalAlertsForQa' },
              totalQaPassedAlerts: { $sum: '$totalQaPassedAlerts' },
              totalQaFailedAlerts: { $sum: '$totalQaFailedAlerts' },
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.length
      ? result[0]
      : {
          totalAlertsForQa: 0,
          totalQaPassedAlerts: 0,
          totalQaFailedAlerts: 0,
        }
  }
}

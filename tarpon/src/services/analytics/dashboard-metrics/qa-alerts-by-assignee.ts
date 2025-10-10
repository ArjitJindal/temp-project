import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  DASHBOARD_QA_ALERTS_BY_ASSIGNEE_STATS_COLLECTION_HOURLY,
} from '@/utils/mongo-table-names'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { DashboardStatsQaAlertsCountByAssigneeData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByAssigneeData'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

@traceable
export class QaAlertsByAssigneeStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_QA_ALERTS_BY_ASSIGNEE_STATS_COLLECTION_HOURLY(tenantId)
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
        $unwind: {
          path: '$alerts.qaAssignment',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'alerts.alertStatus': 'CLOSED',
          'alerts.qaAssignment.assigneeUserId': {
            $exists: true,
            $ne: null,
          },
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
            accountId: '$alerts.qaAssignment.assigneeUserId',
          },
          alertsAssignedForQa: {
            $sum: 1,
          },
          alertsQaedByAssignee: {
            $sum: {
              $cond: {
                if: { $ne: ['$alerts.ruleQaStatus', null] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.time',
          alertsStats: {
            $push: {
              accountId: '$_id.accountId',
              alertsAssignedForQa: '$alertsAssignedForQa',
              alertsQaedByAssignee: '$alertsQaedByAssignee',
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
  ): Promise<DashboardStatsQaAlertsCountByAssigneeData[]> {
    const query = `
    WITH
        arrayJoin(alerts) AS alert,
        arrayJoin(alert.qaAssignments) AS qa
    SELECT
        qa.assigneeUserId AS accountId,
        count(*) AS alertsAssignedForQa,
        sum(if(coalesce(alert.ruleQaStatus, '') != '', 1, 0)) AS alertsQaedByAssignee
    FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    WHERE
        alert.alertStatus = 'CLOSED'
        AND qa.assigneeUserId != ''
        AND toDateTime(alert.updatedAt / 1000)
            BETWEEN toDateTime(${startTimestamp} / 1000)
            AND toDateTime(${endTimestamp} / 1000)
    GROUP BY qa.assigneeUserId
    `

    return await executeClickhouseQuery(tenantId, query)
  }
  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaAlertsCountByAssigneeData[]> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(tenantId, startTimestamp, endTimestamp)
    }
    const db = await getMongoDbClientDb()
    const collection = db.collection(
      DASHBOARD_QA_ALERTS_BY_ASSIGNEE_STATS_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: { accountId: string }
        alertsAssignedForQa: number
        alertsQaedByAssignee: number
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
          { $unwind: { path: '$alertsStats' } },
          {
            $group: {
              _id: {
                accountId: '$alertsStats.accountId',
              },
              alertsAssignedForQa: { $sum: '$alertsStats.alertsAssignedForQa' },
              alertsQaedByAssignee: {
                $sum: '$alertsStats.alertsQaedByAssignee',
              },
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      accountId: x._id.accountId,
      alertsAssignedForQa: x.alertsAssignedForQa,
      alertsQaedByAssignee: x.alertsQaedByAssignee,
    }))
  }
}

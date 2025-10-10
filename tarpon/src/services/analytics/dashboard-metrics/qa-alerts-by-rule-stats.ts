import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  DASHBOARD_QA_ALERTS_BY_RULE_STATS_COLLECTION_HOURLY,
} from '@/utils/mongo-table-names'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { DashboardStatsQaAlertsCountByRuleData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByRuleData'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

@traceable
export class QaAlertsByRuleStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_QA_ALERTS_BY_RULE_STATS_COLLECTION_HOURLY(tenantId)
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
          'alerts.ruleQaStatus': { $ne: null },
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
            ruleId: '$alerts.ruleId',
            ruleInstanceId: '$alerts.ruleInstanceId',
          },
          alertsCount: {
            $sum: 1,
          },
        },
      },
      {
        $group: {
          _id: '$_id.time',
          rulesStats: {
            $push: {
              ruleId: '$_id.ruleId',
              ruleInstanceId: '$_id.ruleInstanceId',
              alertsCount: '$alertsCount',
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
  ): Promise<DashboardStatsQaAlertsCountByRuleData[]> {
    const query = `
    WITH
        arrayJoin(alerts) AS alert
    SELECT
        alert.ruleId AS ruleId,
        alert.ruleInstanceId AS ruleInstanceId,
        count() AS alertsCount
    FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    WHERE
        alert.alertStatus = 'CLOSED'
        AND coalesce(alert.ruleQaStatus, '') != ''
        AND alert.ruleId != ''
        AND toDateTime(alert.updatedAt / 1000.0)
            BETWEEN toDateTime(${startTimestamp} / 1000)
            AND toDateTime(${endTimestamp} / 1000)
    GROUP BY alert.ruleId, alert.ruleInstanceId
    ORDER BY alertsCount DESC
    `
    return await executeClickhouseQuery(tenantId, query)
  }
  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaAlertsCountByRuleData[]> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(tenantId, startTimestamp, endTimestamp)
    }
    const db = await getMongoDbClientDb()
    const collection = db.collection(
      DASHBOARD_QA_ALERTS_BY_RULE_STATS_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: { ruleId: string; ruleInstanceId: string }
        alertsCount: number
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
          { $unwind: { path: '$rulesStats' } },
          {
            $group: {
              _id: {
                ruleId: '$rulesStats.ruleId',
                ruleInstanceId: '$rulesStats.ruleInstanceId',
              },
              alertsCount: { $sum: '$rulesStats.alertsCount' },
            },
          },
          { $sort: { alertsCount: -1 } },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      ruleId: x._id.ruleId,
      ruleInstanceId: x._id.ruleInstanceId,
      alertsCount: x.alertsCount,
    }))
  }
}

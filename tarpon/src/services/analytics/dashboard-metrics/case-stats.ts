import { keyBy, sortBy, sum } from 'lodash'
import { GranularityValuesType } from '../../dashboard/repositories/types'
import { getTimeLabels } from '../../dashboard/utils'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  DAY_DATE_FORMAT,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStatsClosingReasonsData'
import { DashboardStatsAlertPriorityDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStats'
import { notEmpty, notNullish } from '@/utils/array'
import { DashboardStatsAlertAndCaseStatusDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertAndCaseStatusDistributionStats'
import { DashboardStatsAlertAndCaseStatusDistributionStatsData } from '@/@types/openapi-internal/DashboardStatsAlertAndCaseStatusDistributionStatsData'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import {
  getClickhouseClient,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { DashboardStatsAlertPriorityDistributionStatsAlertPriorityData } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStatsAlertPriorityData'
import { tenantTimezone } from '@/core/utils/context'

type ReturnType =
  Array<DashboardStatsAlertPriorityDistributionStatsAlertPriorityData>

type StatusDistributionData = {
  time_label: string
  status: string
  count: number
}

@traceable
export class CaseStatsDashboardMetric {
  public static async getClosingReasonDistributionStatistics(
    tenantId: string,
    entity?: 'CASE' | 'ALERT',
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    if (isClickhouseEnabled()) {
      return this.getClosingReasonDistributionStatisticsClickhouse(
        tenantId,
        entity,
        params
      )
    }
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    let closingReasonsData: DashboardStatsClosingReasonDistributionStatsClosingReasonsData[] =
      []
    if (entity === 'CASE') {
      const reasons = await casesCollection
        .aggregate(
          [
            {
              $match: {
                caseStatus: 'CLOSED',
              },
            },
            params?.startTimestamp != null || params?.endTimestamp != null
              ? {
                  $match: {
                    $and: [
                      params?.startTimestamp != null && {
                        createdTimestamp: {
                          $gte: params?.startTimestamp,
                        },
                      },
                      params?.endTimestamp != null && {
                        createdTimestamp: {
                          $lte: params?.endTimestamp,
                        },
                      },
                    ].filter(notEmpty),
                  },
                }
              : null,
            {
              $unwind: '$lastStatusChange.reason',
            },
            {
              $group: {
                _id: '$lastStatusChange.reason',
                count: { $sum: 1 },
              },
            },
          ].filter(notNullish)
        )

        .toArray()
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    } else if (entity === 'ALERT') {
      const reasons = await casesCollection
        .aggregate(
          [
            params?.startTimestamp != null || params?.endTimestamp != null
              ? {
                  $match: {
                    $and: [
                      params?.startTimestamp != null && {
                        'alerts.createdTimestamp': {
                          $gte: params?.startTimestamp,
                        },
                      },
                      params?.endTimestamp != null && {
                        'alerts.createdTimestamp': {
                          $lte: params?.endTimestamp,
                        },
                      },
                    ].filter(notEmpty),
                  },
                }
              : null,
            {
              $unwind: '$alerts',
            },
            {
              $match: {
                'alerts.alertStatus': 'CLOSED',
                'alerts.lastStatusChange': { $ne: null },
              },
            },
            {
              $project: {
                _id: false,
                lastStatusChange: '$alerts.lastStatusChange',
              },
            },
            {
              $unwind: '$lastStatusChange.reason',
            },
            {
              $group: {
                _id: '$lastStatusChange.reason',
                count: { $sum: 1 },
              },
            },
          ].filter(notEmpty)
        )
        .toArray()
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    }
    return {
      closingReasonsData: sortBy(closingReasonsData, 'reason'),
    }
  }

  private static async getClosingReasonDistributionStatisticsClickhouse(
    tenantId: string,
    entity?: 'CASE' | 'ALERT',
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    const clickhouse = await getClickhouseClient(tenantId)
    let closingReasonsData: DashboardStatsClosingReasonDistributionStatsClosingReasonsData[] =
      []

    if (entity === 'CASE') {
      const query = `
        SELECT
          reason,
          uniqExact(id) as value
        FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
        ARRAY JOIN lastStatusChangeReasons as reason
        WHERE caseStatus = 'CLOSED'
        ${
          params?.startTimestamp
            ? `AND timestamp >= ${params.startTimestamp}`
            : ''
        }
        ${params?.endTimestamp ? `AND timestamp <= ${params.endTimestamp}` : ''}
        GROUP BY reason
        ORDER BY reason ASC
      `

      closingReasonsData = await executeClickhouseQuery<ReturnType>(
        clickhouse,
        { query, format: 'JSONEachRow' }
      )
    } else if (entity === 'ALERT') {
      const query = `
        SELECT
          reason,
          uniqExact(alert.alertId) as value
        FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
        ARRAY JOIN alerts AS alert
        ARRAY JOIN alert.lastStatusChangeReasons AS reason
        WHERE alert.alertStatus = 'CLOSED'
        ${
          params?.startTimestamp
            ? `AND alert.createdTimestamp >= ${params.startTimestamp}`
            : ''
        }
        ${
          params?.endTimestamp
            ? `AND alert.createdTimestamp <= ${params.endTimestamp}`
            : ''
        }
        GROUP BY reason
        ORDER BY reason ASC
      `
      closingReasonsData = await executeClickhouseQuery<ReturnType>(
        clickhouse,
        { query, format: 'JSONEachRow' }
      )
    }

    return {
      closingReasonsData: closingReasonsData.map((reason) => ({
        reason: reason.reason?.replace(/"/g, ''),
        value: Number(reason.value),
      })),
    }
  }

  public static async getAlertPriorityDistributionStatistics(
    tenantId: string,
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsAlertPriorityDistributionStats> {
    if (isClickhouseEnabled()) {
      return this.getAlertPriorityDistributionStatisticsClickhouse(
        tenantId,
        params
      )
    }
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const priorities = await casesCollection
      .aggregate(
        [
          {
            $match: {
              'alerts.alertStatus': {
                $in: ['OPEN', 'REOPENED'],
              },
            },
          },
          params?.startTimestamp != null || params?.endTimestamp != null
            ? {
                $match: {
                  $and: [
                    params?.startTimestamp != null && {
                      'alerts.createdTimestamp': {
                        $gte: params?.startTimestamp,
                      },
                    },
                    params?.endTimestamp != null && {
                      'alerts.createdTimestamp': {
                        $lte: params?.endTimestamp,
                      },
                    },
                  ].filter(notEmpty),
                },
              }
            : null,
          {
            $unwind: '$alerts',
          },
          {
            $match: {
              'alerts.alertStatus': {
                $in: ['OPEN', 'REOPENED'],
              },
            },
          },
          {
            $project: {
              _id: false,
              alert: '$alerts',
            },
          },
          {
            $group: {
              _id: '$alert.priority',
              count: { $sum: 1 },
            },
          },
        ].filter(notEmpty)
      )
      .toArray()
    const alertPriorityData = priorities.map((priority) => {
      return {
        priority: priority._id,
        value: priority.count,
      }
    })
    return {
      alertPriorityData: sortBy(alertPriorityData, 'priority'),
    }
  }
  private static async getAlertPriorityDistributionStatisticsClickhouse(
    tenantId: string,
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsAlertPriorityDistributionStats> {
    const clickhouse = await getClickhouseClient(tenantId)
    let timeFilter = ''
    if (params?.startTimestamp != null || params?.endTimestamp != null) {
      const conditions: string[] = []
      if (params?.startTimestamp != null) {
        conditions.push(`alert.createdTimestamp >= ${params.startTimestamp}`)
      }
      if (params?.endTimestamp != null) {
        conditions.push(`alert.createdTimestamp <= ${params.endTimestamp}`)
      }
      timeFilter = `AND ${conditions.join(' AND ')}`
    }

    const query = `
      SELECT
        alert.priority as priority,
        count(*) as value
      FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
      ARRAY JOIN alerts AS alert
      WHERE alert.alertStatus IN ('OPEN', 'REOPENED')
      ${timeFilter}
      GROUP BY priority
      ORDER BY priority
    `
    const alertPriorityData = await executeClickhouseQuery<
      Array<DashboardStatsAlertPriorityDistributionStatsAlertPriorityData>
    >(clickhouse, {
      query,
      format: 'JSONEachRow',
    })

    return {
      alertPriorityData: alertPriorityData.map((row) => ({
        priority: row.priority,
        value: Number(row.value),
      })),
    } as unknown as DashboardStatsAlertPriorityDistributionStats
  }
  public static async getAlertAndCaseStatusDistributionStatistics(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType,
    entity?: 'CASE' | 'ALERT',
    ruleInstanceIds?: string[]
  ): Promise<DashboardStatsAlertAndCaseStatusDistributionStats> {
    if (isClickhouseEnabled()) {
      return this.getAlertAndCaseStatusDistributionStatisticsClickhouse(
        tenantId,
        startTimestamp,
        endTimestamp,
        granularity,
        entity,
        ruleInstanceIds
      )
    }
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    let mongoTimeFormat: string
    let timeLabels: string[]
    let statusDistributionData
    switch (granularity) {
      case 'DAY': {
        timeLabels = getTimeLabels(
          DAY_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'DAY'
        )
        mongoTimeFormat = DAY_DATE_FORMAT
        break
      }
      case 'MONTH': {
        timeLabels = getTimeLabels(
          MONTH_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'MONTH'
        )
        mongoTimeFormat = MONTH_DATE_FORMAT
        break
      }
      default: {
        timeLabels = getTimeLabels(
          HOUR_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'HOUR'
        )
        mongoTimeFormat = HOUR_DATE_FORMAT
      }
    }
    const matchConditions: Record<string, any>[] = []
    let dateField = 'createdTimestamp'
    if (entity === 'ALERT') {
      dateField = 'alerts.createdTimestamp'
    }
    matchConditions.push({
      [dateField]: {
        $gte: startTimestamp,
        $lt: endTimestamp,
      },
    })
    if (ruleInstanceIds) {
      matchConditions.push({
        'alerts.ruleInstanceId': { $in: ruleInstanceIds },
      })
    }
    if (entity === 'CASE') {
      statusDistributionData = await casesCollection
        .aggregate([
          {
            $match: {
              $and: matchConditions,
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: mongoTimeFormat,
                    date: {
                      $toDate: {
                        $toLong: '$createdTimestamp',
                      },
                    },
                  },
                },
                status: '$caseStatus',
              },
              count: {
                $count: {},
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              items: {
                $addToSet: {
                  k: '$_id.status',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              items: {
                $arrayToObject: '$items',
              },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  {
                    _id: '$_id',
                  },
                  '$items',
                ],
              },
            },
          },
        ])
        .toArray()
    } else {
      statusDistributionData = await casesCollection
        .aggregate([
          {
            $match: {
              $and: matchConditions,
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $match: {
              'alerts.createdTimestamp': {
                $gte: startTimestamp,
                $lt: endTimestamp,
              },
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: mongoTimeFormat,
                    date: {
                      $toDate: {
                        $toLong: '$alerts.createdTimestamp',
                      },
                    },
                  },
                },
                status: '$alerts.alertStatus',
              },
              count: {
                $count: {},
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              items: {
                $addToSet: {
                  k: '$_id.status',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              items: {
                $arrayToObject: '$items',
              },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  {
                    _id: '$_id',
                  },
                  '$items',
                ],
              },
            },
          },
        ])
        .toArray()
    }
    const dashboardStatsById = keyBy(statusDistributionData, '_id')
    return {
      data: timeLabels.map((label) => {
        const stats = dashboardStatsById[label]
        return {
          _id: label,
          count_OPEN: sum([stats?.OPEN ?? 0]),
          count_IN_PROGRESS: sum([
            stats?.OPEN_IN_PROGRESS ?? 0,
            stats?.ESCALATED_IN_PROGRESS ?? 0,
            stats?.ESCALATED_L2_IN_PROGRESS ?? 0,
          ]),
          count_ON_HOLD: sum([
            stats?.OPEN_ON_HOLD ?? 0,
            stats?.ESCALATED_ON_HOLD ?? 0,
            stats?.ESCALATED_L2_ON_HOLD ?? 0,
          ]),
          count_ESCALATED: sum([stats?.ESCALATED ?? 0]),
          count_ESCALATED_L2: sum([stats?.ESCALATED_L2 ?? 0]),
          count_CLOSED: sum([stats?.CLOSED ?? 0]),
          count_REOPENED: sum([stats?.REOPENED ?? 0]),
          count_IN_REVIEW: sum([
            stats?.IN_REVIEW_OPEN ?? 0,
            stats?.IN_REVIEW_ESCALATED ?? 0,
            stats?.IN_REVIEW_CLOSED ?? 0,
            stats?.IN_REVIEW_REOPENED ?? 0,
          ]),
        } as DashboardStatsAlertAndCaseStatusDistributionStatsData
      }),
    }
  }
  public static async getAlertAndCaseStatusDistributionStatisticsClickhouse(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType = 'HOUR',
    entity: 'CASE' | 'ALERT' = 'CASE',
    ruleInstanceIds?: string[]
  ): Promise<DashboardStatsAlertAndCaseStatusDistributionStats> {
    const timezone = await tenantTimezone(tenantId)
    const clickhouseClient = await getClickhouseClient(tenantId)
    let timeFormat: string
    let timeLabels: string[]
    switch (granularity) {
      case 'DAY': {
        timeLabels = getTimeLabels(
          DAY_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'DAY'
        )
        timeFormat = DAY_DATE_FORMAT
        break
      }
      case 'MONTH': {
        timeLabels = getTimeLabels(
          MONTH_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'MONTH'
        )
        timeFormat = MONTH_DATE_FORMAT
        break
      }
      default: {
        timeLabels = getTimeLabels(
          HOUR_DATE_FORMAT_JS,
          startTimestamp,
          endTimestamp,
          'HOUR'
        )
        timeFormat = HOUR_DATE_FORMAT
      }
    }
    const idField = entity === 'CASE' ? 'caseId' : 'alerts.alertId'
    const statusField = entity === 'CASE' ? 'caseStatus' : 'alerts.alertStatus'
    const timestampField =
      entity === 'CASE' ? 'timestamp' : 'alerts.createdTimestamp'

    const query = `
      SELECT
        formatDateTime(fromUnixTimestamp64Milli(${timestampField}), '${timeFormat}', '${timezone}') as time_label,
        ${statusField} as status,
        count(distinct(${idField})) as count
      FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
      ${entity === 'ALERT' || ruleInstanceIds ? 'ARRAY JOIN alerts' : ''}
      WHERE ${timestampField} >= ${startTimestamp}
        AND ${timestampField} < ${endTimestamp}
        ${
          ruleInstanceIds
            ? `AND alerts.ruleInstanceId IN ('${ruleInstanceIds.join("','")}')`
            : ''
        }
      GROUP BY
        time_label,
        status
      ORDER BY time_label
    `
    const statusDistributionData = await executeClickhouseQuery<
      StatusDistributionData[]
    >(clickhouseClient, { query, format: 'JSONEachRow' })

    const statusByTimeLabel = statusDistributionData.reduce((acc, row) => {
      if (!acc[row.time_label]) {
        acc[row.time_label] = {}
      }
      acc[row.time_label][row.status] = Number(row.count)
      return acc
    }, {} as Record<string, Record<string, number>>)

    return {
      data: timeLabels.map((label) => {
        const stats = statusByTimeLabel[label] || {}
        return {
          _id: label,
          count_OPEN: sum([stats.OPEN ?? 0]),
          count_IN_PROGRESS: sum([
            stats.OPEN_IN_PROGRESS ?? 0,
            stats.ESCALATED_IN_PROGRESS ?? 0,
            stats.ESCALATED_L2_IN_PROGRESS ?? 0,
          ]),
          count_ON_HOLD: sum([
            stats.OPEN_ON_HOLD ?? 0,
            stats.ESCALATED_ON_HOLD ?? 0,
            stats.ESCALATED_L2_ON_HOLD ?? 0,
          ]),
          count_ESCALATED: sum([stats.ESCALATED ?? 0]),
          count_ESCALATED_L2: sum([stats.ESCALATED_L2 ?? 0]),
          count_CLOSED: sum([stats.CLOSED ?? 0]),
          count_REOPENED: sum([stats.REOPENED ?? 0]),
          count_IN_REVIEW: sum([
            stats.IN_REVIEW_OPEN ?? 0,
            stats.IN_REVIEW_ESCALATED ?? 0,
            stats.IN_REVIEW_CLOSED ?? 0,
            stats.IN_REVIEW_REOPENED ?? 0,
          ]),
        } as DashboardStatsAlertAndCaseStatusDistributionStatsData
      }),
    }
  }
}

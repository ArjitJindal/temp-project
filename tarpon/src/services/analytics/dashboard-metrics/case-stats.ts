import { keyBy, sortBy, sum } from 'lodash'
import { GranularityValuesType } from '../../dashboard/repositories/types'
import { getTimeLabels } from '../../dashboard/utils'
import {
  DAY_DATE_FORMAT,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT,
  MONTH_DATE_FORMAT_JS,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStatsClosingReasonsData'
import { DashboardStatsAlertPriorityDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStats'
import { notEmpty, notNullish } from '@/utils/array'
import { DashboardStatsAlertAndCaseStatusDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertAndCaseStatusDistributionStats'
import { DashboardStatsAlertAndCaseStatusDistributionStatsData } from '@/@types/openapi-internal/DashboardStatsAlertAndCaseStatusDistributionStatsData'
import { traceable } from '@/core/xray'

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
              $match: {
                'alerts.alertStatus': 'CLOSED',
                'alerts.lastStatusChange': { $ne: null },
              },
            },
            {
              $unwind: '$alerts',
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

  public static async getAlertPriorityDistributionStatistics(
    tenantId: string,
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsAlertPriorityDistributionStats> {
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

  public static async getAlertAndCaseStatusDistributionStatistics(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType,
    entity?: 'CASE' | 'ALERT'
  ): Promise<DashboardStatsAlertAndCaseStatusDistributionStats> {
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
    if (entity === 'CASE') {
      statusDistributionData = await casesCollection
        .aggregate([
          {
            $match: {
              createdTimestamp: {
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
              'alerts.createdTimestamp': {
                $gte: startTimestamp,
                $lt: endTimestamp,
              },
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
}

import { sortBy } from 'lodash'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStatsClosingReasonsData'
import { DashboardStatsAlertPriorityDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStats'

export class CaseStatsDashboardMetric {
  public static async getClosingReasonDistributionStatistics(
    tenantId: string,
    entity?: 'CASE' | 'ALERT'
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    let closingReasonsData: DashboardStatsClosingReasonDistributionStatsClosingReasonsData[] =
      []
    if (entity === 'CASE') {
      const reasons = await casesCollection
        .aggregate([
          {
            $match: { caseStatus: 'CLOSED' },
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
        ])
        .toArray()
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    } else if (entity === 'ALERT') {
      const reasons = await casesCollection
        .aggregate([
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
        ])
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
    tenantId: string
  ): Promise<DashboardStatsAlertPriorityDistributionStats> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const priorities = await casesCollection
      .aggregate([
        {
          $match: {
            'alerts.alertStatus': {
              $in: ['OPEN', 'REOPENED'],
            },
          },
        },
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
      ])
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
}

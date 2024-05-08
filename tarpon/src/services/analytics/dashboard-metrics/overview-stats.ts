import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
  REPORT_COLLECTION,
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsOverview } from '@/@types/openapi-internal/DashboardStatsOverview'
import { hasFeature } from '@/core/utils/context'
import { DashboardTeamStatsItem } from '@/@types/openapi-internal/DashboardTeamStatsItem'
import { traceable } from '@/core/xray'

@traceable
export class OverviewStatsDashboardMetric {
  public static async getAverageInvestigationTime(
    tenantId: string,
    type: 'cases' | 'alerts',
    accountIds?: string[]
  ): Promise<number> {
    const db = await getMongoDbClientDb()
    const dashboardStatsCollection = db.collection<DashboardTeamStatsItem>(
      type === 'cases'
        ? DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)
        : DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
    )
    const pipeline = [
      ...(accountIds
        ? [
            {
              $match: {
                accountId: { $in: accountIds },
              },
            },
          ]
        : []),
      {
        $group: {
          _id: null,
          caseIds: {
            $push: '$caseIds',
          },
          investigationTime: {
            $sum: '$investigationTime',
          },
        },
      },
      {
        $project: {
          _id: false,
          investigationTime: true,
          caseIds: {
            $reduce: {
              input: '$caseIds',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          avgInvestigationTime: {
            $cond: {
              if: { $gt: [{ $size: '$caseIds' }, 0] },
              then: { $divide: ['$investigationTime', { $size: '$caseIds' }] },
              else: 0,
            },
          },
        },
      },
    ]
    const dashboardStats = await dashboardStatsCollection
      .aggregate<{ avgInvestigationTime: number }>(pipeline)
      .toArray()

    return dashboardStats[0]?.avgInvestigationTime ?? 0
  }

  public static async get(
    tenantId: string,
    accountIds: string[]
  ): Promise<DashboardStatsOverview> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const reportsCollection = db.collection<Report>(REPORT_COLLECTION(tenantId))

    const [
      casesCount,
      alertsCount,
      totalSarReported,
      averageInvestigationTimeCases,
      averageInvestigationTimeAlerts,
    ] = await Promise.all([
      casesCollection.countDocuments({
        caseStatus: { $in: ['OPEN', 'REOPENED'] },
      }),
      casesCollection
        .aggregate([
          {
            $match: {
              'alerts.alertStatus': {
                $in: ['OPEN', 'REOPENED'],
              },
            },
          },
          {
            $unwind: {
              path: '$alerts',
            },
          },
          {
            $match: {
              'alerts.alertStatus': {
                $in: ['OPEN', 'REOPENED'],
              },
            },
          },
          {
            $count: 'count',
          },
        ])
        .toArray()
        .then((result) => result[0]?.count ?? 0),

      hasFeature('SAR')
        ? reportsCollection.countDocuments({ status: 'COMPLETE' })
        : 0,
      this.getAverageInvestigationTime(tenantId, 'cases', accountIds),
      this.getAverageInvestigationTime(tenantId, 'alerts', accountIds),
    ])

    return {
      totalOpenCases: casesCount,
      totalOpenAlerts: alertsCount,
      averageInvestigationTimeCases,
      averageInvestigationTimeAlerts,
      totalSarReported,
    }
  }
}

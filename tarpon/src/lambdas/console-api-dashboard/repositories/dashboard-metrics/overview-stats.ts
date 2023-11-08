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
  public static async get(
    tenantId: string,
    accountIds: string[]
  ): Promise<DashboardStatsOverview> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

    const casesCount = await casesCollection.countDocuments({
      caseStatus: { $in: ['OPEN', 'REOPENED'] },
    })

    const alertsCount = await casesCollection
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
    const dashboardCasesStatsHourlyCollection =
      db.collection<DashboardTeamStatsItem>(
        DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)
      )
    const investigationTimePipeline = [
      {
        $match: {
          accountId: { $in: accountIds },
        },
      },
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
    const dashboardCasesStatsTotal = await dashboardCasesStatsHourlyCollection
      .aggregate<{ avgInvestigationTime: number }>(investigationTimePipeline)
      .toArray()
    const dashboardAlertsStatsCollection =
      db.collection<DashboardTeamStatsItem>(
        DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
      )
    const dashboardAlertsStatsTotal = await dashboardAlertsStatsCollection
      .aggregate<{ avgInvestigationTime: number }>(investigationTimePipeline)
      .toArray()
    let totalSarReported = 0
    if (hasFeature('SAR')) {
      const reportsCollection = db.collection<Report>(
        REPORT_COLLECTION(tenantId)
      )
      const queryFilter = { status: 'COMPLETE' }
      totalSarReported = await reportsCollection.countDocuments(queryFilter)
    }
    return {
      totalOpenCases: casesCount,
      totalOpenAlerts: alertsCount[0]?.count ?? 0,
      averageInvestigationTimeCases:
        dashboardCasesStatsTotal[0]?.avgInvestigationTime,
      averageInvestigationTimeAlerts:
        dashboardAlertsStatsTotal[0]?.avgInvestigationTime,
      totalSarReported,
    }
  }
}

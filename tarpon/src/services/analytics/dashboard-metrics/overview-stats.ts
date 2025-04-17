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
import {
  getClickhouseClient,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { getInvestigationTimes } from '@/utils/clickhouse/materialised-views-queries'

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
    const reportsCollection = db.collection<Report>(REPORT_COLLECTION(tenantId))
    const totalSarReported = hasFeature('SAR')
      ? await reportsCollection.countDocuments({ status: 'COMPLETE' })
      : 0
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const [casesCount, alertsCount] = await Promise.all([
      casesCollection.countDocuments({
        caseStatus: { $in: ['OPEN', 'REOPENED'] },
        createdTimestamp: { $lte: Date.now() },
      }),
      casesCollection
        .aggregate([
          {
            $match: {
              'alerts.alertStatus': {
                $in: ['OPEN', 'REOPENED'],
              },
              createdTimestamp: { $lte: Date.now() },
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
    ])
    if (isClickhouseEnabled()) {
      const clickhouseStats = await this.getClickhouse(tenantId, accountIds)
      return {
        ...clickhouseStats,
        totalSarReported,
        totalOpenCases: casesCount,
        totalOpenAlerts: alertsCount,
      }
    }

    const [averageInvestigationTimeCases, averageInvestigationTimeAlerts] =
      await Promise.all([
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

  public static async getClickhouse(
    tenantId: string,
    accountIds: string[]
  ): Promise<DashboardStatsOverview> {
    // type ClickhouseCountResult = Array<{ count: number }>

    // const clickhouseClient = await getClickhouseClient(tenantId)

    // const casesCountQuery = `
    //   SELECT count(*) as count
    //   FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    //   WHERE caseStatus IN ('OPEN', 'REOPENED')
    //     AND timestamp <= toUnixTimestamp64Milli(now64())
    // `
    // const alertsCountQuery = `
    //   SELECT count(*) as count
    //   FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
    //   ARRAY JOIN alerts as alert
    //   WHERE alert.2 IN ('OPEN', 'REOPENED')
    //   AND alert.createdTimestamp <= toUnixTimestamp64Milli(now64())
    ;`
    // const sarReportsQuery = `
    //   SELECT count(*) as count
    //   FROM ${CLICKHOUSE_DEFINITIONS.REPORTS.tableName} FINAL
    //   WHERE status = 'COMPLETE'
    // `

    const [
      // casesCountResult,
      // alertsCountResult,
      // sarReportsResult,
      averageInvestigationTimeCases,
      averageInvestigationTimeAlerts,
    ] = await Promise.all([
      // executeClickhouseQuery<ClickhouseCountResult>(clickhouseClient, {
      //   query: casesCountQuery,
      //   format: 'JSONEachRow',
      // }),

      // executeClickhouseQuery<ClickhouseCountResult>(clickhouseClient, {
      //   query: alertsCountQuery,
      //   format: 'JSONEachRow',
      // }),

      // hasFeature('SAR')
      //   ? clickhouseClient
      //       .query({
      //         query: sarReportsQuery,
      //         format: 'JSONEachRow',
      //       })
      //       .then((r) => r.json<{ count: number }>())
      //   : Promise.resolve([{ count: 0 }]),

      this.getAverageInvestigationTimeClickhouse(tenantId, 'cases', accountIds),
      this.getAverageInvestigationTimeClickhouse(
        tenantId,
        'alerts',
        accountIds
      ),
    ])

    return {
      totalOpenCases: 0,
      totalOpenAlerts: 0,
      averageInvestigationTimeCases,
      averageInvestigationTimeAlerts,
      totalSarReported: 0,
    }
  }

  public static async getAverageInvestigationTimeClickhouse(
    tenantId: string,
    type: 'cases' | 'alerts',
    accountIds?: string[]
  ): Promise<number> {
    const clickhouseClient = await getClickhouseClient(tenantId)
    const viewQuery =
      type === 'cases'
        ? getInvestigationTimes('CASES')
        : getInvestigationTimes('ALERTS')

    const query = `
      WITH ${viewQuery}
      SELECT 
        if(length(arrayDistinct(arrayFlatten(groupArray(caseId)))) > 0,
          sum(investigationTime) / length(arrayDistinct(arrayFlatten(groupArray(caseId)))),
          0) as avgInvestigationTime
      FROM investigation_times
      ${
        accountIds?.length
          ? `WHERE accountId IN (${accountIds
              .map((id) => `'${id}'`)
              .join(',')})`
          : ''
      }
      GROUP BY tuple()
    `

    const result = await executeClickhouseQuery<
      Array<{ avgInvestigationTime: number }>
    >(clickhouseClient, {
      query,
      format: 'JSONEachRow',
    })

    return result[0]?.avgInvestigationTime ?? 0
  }
}

import { MongoClient } from 'mongodb'
import { GranularityValuesType, TimeRange } from './types'
import { TransactionStatsDashboardMetric } from './dashboard-metrics/transaction-stats'
import { HitsByUserStatsDashboardMetric } from './dashboard-metrics/hits-by-user-stats'
import { RuleHitsStatsDashboardMetric } from './dashboard-metrics/rule-stats'
import { TeamStatsDashboardMetric } from './dashboard-metrics/team-stats'
import { OverviewStatsDashboardMetric } from './dashboard-metrics/overview-stats'
import { CaseStatsDashboardMetric } from './dashboard-metrics/case-stats'
import { LatestTeamStatsDashboardMetric } from './dashboard-metrics/latest-team-stats'
import { DashboardTeamStatsItem } from '@/@types/openapi-internal/DashboardTeamStatsItem'
import { DashboardStatsRulesCountData } from '@/@types/openapi-internal/DashboardStatsRulesCountData'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { DashboardStatsHitsPerUserData } from '@/@types/openapi-internal/DashboardStatsHitsPerUserData'
import { DashboardStatsOverview } from '@/@types/openapi-internal/DashboardStatsOverview'
import { traceable } from '@/core/xray'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { DashboardStatsAlertPriorityDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStats'
import { DashboardStatsAlertAndCaseStatusDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertAndCaseStatusDistributionStats'
import { UserStats } from '@/lambdas/console-api-dashboard/repositories/dashboard-metrics/user-stats'
import { DashboardLatestTeamStatsItem } from '@/@types/openapi-internal/DashboardLatestTeamStatsItem'
import { DashboardStatsUsersStats } from '@/@types/openapi-internal/DashboardStatsUsersStats'

@traceable
export class DashboardStatsRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async refreshAllStats(timeRange?: TimeRange) {
    await Promise.all([
      this.refreshTransactionStats(timeRange),
      this.refreshCaseStats(timeRange),
      this.refreshUserStats(timeRange),
      this.refreshTeamStats(timeRange),
      this.refreshLatestTeamStats(),
    ])
  }

  public async recalculateHitsByUser(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ) {
    await HitsByUserStatsDashboardMetric.refreshCaseStats(
      this.tenantId,
      direction,
      timeRange
    )
  }
  public async getHitsByUserStats(
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION',
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<DashboardStatsHitsPerUserData[]> {
    return HitsByUserStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      direction,
      userType
    )
  }

  public async recalculateRuleHitStats(timeRange?: TimeRange) {
    await RuleHitsStatsDashboardMetric.refresh(this.tenantId, timeRange)
  }
  public async getRuleHitCountStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsRulesCountData[]> {
    return RuleHitsStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }

  public async getTeamStatistics(
    scope: 'CASES' | 'ALERTS',
    startTimestamp?: number,
    endTimestamp?: number,
    status?: (CaseStatus | AlertStatus)[],
    accountIds?: Array<string>
  ): Promise<DashboardTeamStatsItem[]> {
    return TeamStatsDashboardMetric.get(
      this.tenantId,
      scope,
      startTimestamp,
      endTimestamp,
      status,
      accountIds
    )
  }

  public async getUserTimewindowStats(
    userType: 'BUSINESS' | 'CONSUMER',
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType
  ): Promise<DashboardStatsUsersStats[]> {
    return UserStats.get(
      this.tenantId,
      userType,
      startTimestamp,
      endTimestamp,
      granularity
    )
  }

  public async refreshTransactionStats(timestampTimeRange?: TimeRange) {
    await Promise.all([
      TransactionStatsDashboardMetric.refresh(
        this.tenantId,
        timestampTimeRange
      ),
      HitsByUserStatsDashboardMetric.refreshTransactionsStats(
        this.tenantId,
        'DESTINATION',
        timestampTimeRange
      ),
      HitsByUserStatsDashboardMetric.refreshTransactionsStats(
        this.tenantId,
        'ORIGIN',
        timestampTimeRange
      ),
    ])
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsTransactionsCountData[]> {
    return TransactionStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      granularity
    )
  }

  public async refreshCaseStats(caseCreatedAtTimeRange?: TimeRange) {
    await Promise.all([
      this.recalculateRuleHitStats(caseCreatedAtTimeRange),
      this.recalculateHitsByUser('ORIGIN', caseCreatedAtTimeRange),
      this.recalculateHitsByUser('DESTINATION', caseCreatedAtTimeRange),
    ])
  }

  public async refreshUserStats(userCreatedTimestampTimeRange?: TimeRange) {
    await UserStats.refresh(this.tenantId, userCreatedTimestampTimeRange)
  }

  public async refreshTeamStats(caseUpdatedAtTimeRange?: TimeRange) {
    await TeamStatsDashboardMetric.refresh(
      this.tenantId,
      caseUpdatedAtTimeRange
    )
  }

  public async refreshLatestTeamStats() {
    await LatestTeamStatsDashboardMetric.refresh(this.tenantId)
  }

  async getOverviewStatistics(
    accountIds: string[]
  ): Promise<DashboardStatsOverview> {
    return OverviewStatsDashboardMetric.get(this.tenantId, accountIds)
  }

  async getClosingReasonDistributionStatistics(
    entity?: 'CASE' | 'ALERT',
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    return CaseStatsDashboardMetric.getClosingReasonDistributionStatistics(
      this.tenantId,
      entity,
      params
    )
  }
  async getAlertPriorityDistributionStatistics(params?: {
    startTimestamp: number | undefined
    endTimestamp: number | undefined
  }): Promise<DashboardStatsAlertPriorityDistributionStats> {
    return CaseStatsDashboardMetric.getAlertPriorityDistributionStatistics(
      this.tenantId,
      params
    )
  }

  async getAlertAndCaseStatusDistributionStatistics(
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType,
    entity?: 'CASE' | 'ALERT'
  ): Promise<DashboardStatsAlertAndCaseStatusDistributionStats> {
    return CaseStatsDashboardMetric.getAlertAndCaseStatusDistributionStatistics(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      granularity,
      entity
    )
  }

  public async getLatestTeamStatistics(
    scope: 'CASES' | 'ALERTS',
    accountIds?: Array<string>
  ): Promise<DashboardLatestTeamStatsItem[]> {
    return LatestTeamStatsDashboardMetric.get(this.tenantId, scope, accountIds)
  }
}

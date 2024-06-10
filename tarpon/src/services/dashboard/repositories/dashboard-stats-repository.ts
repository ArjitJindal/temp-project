import { MongoClient } from 'mongodb'
import { TransactionStatsDashboardMetric } from '../../analytics/dashboard-metrics/transaction-stats'
import { HitsByUserStatsDashboardMetric } from '../../analytics/dashboard-metrics/hits-by-user-stats'
import { RuleHitsStatsDashboardMetric } from '../../analytics/dashboard-metrics/rule-stats'
import { TeamStatsDashboardMetric } from '../../analytics/dashboard-metrics/team-stats'
import { OverviewStatsDashboardMetric } from '../../analytics/dashboard-metrics/overview-stats'
import { CaseStatsDashboardMetric } from '../../analytics/dashboard-metrics/case-stats'
import { LatestTeamStatsDashboardMetric } from '../../analytics/dashboard-metrics/latest-team-stats'
import { QaAlertsByRuleStatsDashboardMetric } from '../../analytics/dashboard-metrics/qa-alerts-by-rule-stats'
import { QaOverviewStatsDashboardMetric } from '../../analytics/dashboard-metrics/qa-overview'
import { QaAlertsByChecklistReasonStatsDashboardMetric } from '../../analytics/dashboard-metrics/qa-alerts-by-checklist-reason'
import { QaAlertsByAssigneeStatsDashboardMetric } from '../../analytics/dashboard-metrics/qa-alerts-by-assignee'
import { GranularityValuesType, TimeRange } from './types'
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
import { UserStats } from '@/services/analytics/dashboard-metrics/user-stats'
import { DashboardLatestTeamStatsItem } from '@/@types/openapi-internal/DashboardLatestTeamStatsItem'
import { DashboardStatsUsersStats } from '@/@types/openapi-internal/DashboardStatsUsersStats'
import { DashboardStatsQaAlertsCountByRuleData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByRuleData'
import { DashboardStatsQaOverview } from '@/@types/openapi-internal/DashboardStatsQaOverview'
import { tenantHasFeature } from '@/core/utils/context'
import { DashboardStatsQaAlertsStatsByChecklistReasonData } from '@/@types/openapi-internal/DashboardStatsQaAlertsStatsByChecklistReasonData'
import { DashboardStatsQaAlertsCountByAssigneeData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByAssigneeData'

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
      this.refreshQaStats(timeRange),
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
      this.refreshQaStats(caseCreatedAtTimeRange),
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

  public async refreshQaStats(caseUpdatedAtTimeRange?: TimeRange) {
    if (!(await tenantHasFeature(this.tenantId, 'QA'))) {
      return
    }
    await Promise.all([
      this.recalculateQaAlertsByRuleStats(caseUpdatedAtTimeRange),
      this.recalculateQaAlertsStatsByChecklistReason(caseUpdatedAtTimeRange),
      this.recalculateQaOverviewStats(caseUpdatedAtTimeRange),
      this.recalculateQaAlertsByAssigneeStats(caseUpdatedAtTimeRange),
    ])
  }
  public async recalculateQaAlertsByRuleStats(timeRange?: TimeRange) {
    await QaAlertsByRuleStatsDashboardMetric.refresh(this.tenantId, timeRange)
  }
  public async recalculateQaAlertsStatsByChecklistReason(
    timeRange?: TimeRange
  ) {
    await QaAlertsByChecklistReasonStatsDashboardMetric.refresh(
      this.tenantId,
      timeRange
    )
  }
  public async recalculateQaOverviewStats(timeRange?: TimeRange) {
    await QaOverviewStatsDashboardMetric.refresh(this.tenantId, timeRange)
  }

  public async recalculateQaAlertsByAssigneeStats(timeRange?: TimeRange) {
    await QaAlertsByAssigneeStatsDashboardMetric.refresh(
      this.tenantId,
      timeRange
    )
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

  public async getQaAlertsByRuleHitStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaAlertsCountByRuleData[]> {
    return QaAlertsByRuleStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }

  public async getQaAlertsStatsByChecklistReason(
    startTimestamp: number,
    endTimestamp: number,
    checklistTemplateId: string,
    checklistCategory: string
  ): Promise<DashboardStatsQaAlertsStatsByChecklistReasonData[]> {
    return QaAlertsByChecklistReasonStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      checklistTemplateId,
      checklistCategory
    )
  }

  public async getQaOverviewStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaOverview> {
    return QaOverviewStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }

  public async getQaAlertsByAssigneeStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsQaAlertsCountByAssigneeData[]> {
    return QaAlertsByAssigneeStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }
}

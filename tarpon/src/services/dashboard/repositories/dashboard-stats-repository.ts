import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
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
import { DashboardStatsUsersStats } from '@/@types/openapi-internal/DashboardStatsUsersStats'
import { DashboardStatsQaAlertsCountByRuleData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByRuleData'
import { DashboardStatsQaOverview } from '@/@types/openapi-internal/DashboardStatsQaOverview'
import { tenantHasFeature } from '@/core/utils/context'
import { DashboardStatsQaAlertsStatsByChecklistReasonData } from '@/@types/openapi-internal/DashboardStatsQaAlertsStatsByChecklistReasonData'
import { DashboardStatsQaAlertsCountByAssigneeData } from '@/@types/openapi-internal/DashboardStatsQaAlertsCountByAssigneeData'
import { DashboardStatsRulesCountResponse } from '@/@types/openapi-internal/DashboardStatsRulesCountResponse'
import { TeamSLAStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/sla-team-stats'
import { DashboardStatsTeamSLAItemResponse } from '@/@types/openapi-internal/DashboardStatsTeamSLAItemResponse'
import { DashboardLatestTeamStatsItemResponse } from '@/@types/openapi-internal/DashboardLatestTeamStatsItemResponse'
import { DashboardTeamStatsItemResponse } from '@/@types/openapi-internal/DashboardTeamStatsItemResponse'
import { DashboardStatsTransactionTypeDistribution } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistribution'
import { TransactionsTypeDistributionDashboardMetric } from '@/services/analytics/dashboard-metrics/transaction-type-stats'
import { DashboardStatsPaymentApprovals } from '@/@types/openapi-internal/DashboardStatsPaymentApprovals'
import { PaymentApprovalsDashboardMetric } from '@/services/analytics/dashboard-metrics/payment-approvals'

@traceable
export class DashboardStatsRepository {
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb
    this.tenantId = tenantId
  }

  public async refreshAllStats(timeRange?: TimeRange) {
    await Promise.all([
      this.refreshTransactionStats(timeRange),
      this.refreshAlertsStats(timeRange),
      this.refreshUserStats(timeRange),
      this.refreshTeamStats(this.dynamoDb, timeRange),
      this.refreshQaStats(timeRange),
      this.refreshLatestTeamStats(),
      this.refreshSLATeamStats(timeRange),
      this.refreshTransactionsTypeDistribution(timeRange),
    ])
  }

  public async recalculateHitsByUser(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ) {
    await HitsByUserStatsDashboardMetric.refreshAlertsStats(
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
    await RuleHitsStatsDashboardMetric.refreshTransactionsStats(
      this.tenantId,
      timeRange
    )
  }
  public async recalculateRuleHitAlertsStats(timeRange?: TimeRange) {
    await RuleHitsStatsDashboardMetric.refreshAlertsStats(
      this.tenantId,
      timeRange
    )
  }
  public async recalculateRuleRunCountStats(timeRange?: TimeRange) {
    await RuleHitsStatsDashboardMetric.refreshRuleRunCount(
      this.tenantId,
      timeRange
    )
  }

  public async refreshRuleHitStats(timeRange?: TimeRange) {
    await this.recalculateRuleHitStats(timeRange)
    await this.recalculateRuleHitAlertsStats(timeRange)
    await this.recalculateRuleRunCountStats(timeRange)
  }
  public async getRuleHitCountStats(
    startTimestamp: number,
    endTimestamp: number,
    pageSize?: number | 'DISABLED',
    page?: number
  ): Promise<DashboardStatsRulesCountResponse> {
    return RuleHitsStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      pageSize,
      page
    )
  }

  public async getTeamStatistics(
    scope: 'CASES' | 'ALERTS',
    startTimestamp?: number,
    endTimestamp?: number,
    status?: (CaseStatus | AlertStatus)[],
    accountIds?: { id: string; role: string }[],
    pageSize?: number,
    page?: number
  ): Promise<DashboardTeamStatsItemResponse> {
    return TeamStatsDashboardMetric.get(
      this.tenantId,
      scope,
      startTimestamp ?? 0,
      endTimestamp ?? 0,
      status ?? [],
      accountIds ?? [],
      pageSize ?? 20,
      page ?? 1
    )
  }

  public async getSLATeamStatistics(
    startTimestamp?: number,
    endTimestamp?: number,
    pageSize?: number,
    page?: number
  ): Promise<DashboardStatsTeamSLAItemResponse> {
    return TeamSLAStatsDashboardMetric.get(
      this.tenantId,
      { startTimestamp, endTimestamp },
      pageSize,
      page
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
      this.recalculateRuleHitStats(timestampTimeRange),
      this.refreshTransactionsTypeDistribution(timestampTimeRange),
    ])
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType,
    type?: 'TOTAL' | 'DATE_RANGE'
  ): Promise<DashboardStatsTransactionsCountData[]> {
    return TransactionStatsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      granularity,
      type
    )
  }

  public async refreshAlertsStats(alertCreatedAtTimeRange?: TimeRange) {
    await Promise.all([
      this.recalculateRuleHitAlertsStats(alertCreatedAtTimeRange),
      this.recalculateHitsByUser('ORIGIN', alertCreatedAtTimeRange),
      this.recalculateHitsByUser('DESTINATION', alertCreatedAtTimeRange),
    ])
  }

  public async refreshUserStats(userCreatedTimestampTimeRange?: TimeRange) {
    await UserStats.refresh(this.tenantId, userCreatedTimestampTimeRange)
  }

  public async refreshTeamStats(
    dynamoDb: DynamoDBClient,
    caseUpdatedAtTimeRange?: TimeRange
  ) {
    await TeamStatsDashboardMetric.refresh(
      this.tenantId,
      dynamoDb,
      caseUpdatedAtTimeRange
    )
  }

  public async refreshLatestTeamStats() {
    await LatestTeamStatsDashboardMetric.refresh(this.tenantId, this.dynamoDb)
  }

  public async refreshQaStats(alertUpdatedAtTimeRange?: TimeRange) {
    if (!(await tenantHasFeature(this.tenantId, 'QA'))) {
      return
    }
    await Promise.all([
      this.recalculateQaAlertsByRuleStats(alertUpdatedAtTimeRange),
      this.recalculateQaAlertsStatsByChecklistReason(alertUpdatedAtTimeRange),
      this.recalculateQaOverviewStats(alertUpdatedAtTimeRange),
      this.recalculateQaAlertsByAssigneeStats(alertUpdatedAtTimeRange),
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

  public async refreshSLATeamStats(timeRange?: TimeRange) {
    if (!(await tenantHasFeature(this.tenantId, 'ALERT_SLA'))) {
      return
    }
    await TeamSLAStatsDashboardMetric.refresh(this.tenantId, timeRange)
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
    entity?: 'CASE' | 'ALERT' | 'PAYMENT',
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    if (entity === 'CASE' || entity === 'ALERT') {
      return CaseStatsDashboardMetric.getClosingReasonDistributionStatistics(
        this.tenantId,
        entity,
        params
      )
    }
    return TransactionStatsDashboardMetric.getPaymentClosingReasonDistributionStatistics(
      this.tenantId,
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
    entity?: 'CASE' | 'ALERT',
    ruleInstanceIds?: string[]
  ): Promise<DashboardStatsAlertAndCaseStatusDistributionStats> {
    return CaseStatsDashboardMetric.getAlertAndCaseStatusDistributionStatistics(
      this.tenantId,
      startTimestamp,
      endTimestamp,
      granularity,
      entity,
      ruleInstanceIds
    )
  }

  public async getLatestTeamStatistics(
    scope: 'CASES' | 'ALERTS',
    accounts?: { id: string; role: string }[],
    pageSize?: number,
    page?: number
  ): Promise<DashboardLatestTeamStatsItemResponse> {
    return LatestTeamStatsDashboardMetric.get(
      this.tenantId,
      scope,
      accounts ?? [],
      pageSize,
      page
    )
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

  public async getTransactionsTypeDistribution(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsTransactionTypeDistribution> {
    return TransactionsTypeDistributionDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }

  public async refreshTransactionsTypeDistribution(timeRange?: TimeRange) {
    await TransactionsTypeDistributionDashboardMetric.refresh(
      this.tenantId,
      timeRange
    )
  }

  public async getPaymentApprovalsStatistics(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsPaymentApprovals[]> {
    return PaymentApprovalsDashboardMetric.get(
      this.tenantId,
      startTimestamp,
      endTimestamp
    )
  }
}

import { TenantDeletionBatchJobRunner } from './tenant-deletion-batch-job-runner'
import { SimulationRiskFactorsBatchJobRunner } from './simulation-risk-scoring-batch-job-runner'
import { RulePreAggregationBatchJobRunner } from './rule-pre-aggregation-batch-job-runner'
import {
  AlertSLAStatusRefreshBatchJobRunner,
  CaseSLAStatusRefreshBatchJobRunner,
} from './sla-status-refresh-batch-job-runner'
import { ReverifyTransactionsBatchJobRunner } from './reverify-transactions-job-runner'
import { BackfillAvgTrsRunner } from './backfill-avg-trs-runner'
import { RiskScoringRecalculationBatchJobRunner } from './risk-scoring-recalculation-batch-job-runner'
import { SimulationV8RiskFactorsBatchJobRunner } from './simulation-v8-risk-scoring-batch-job-runner'
import { PnbBackfillEntitiesBatchJobRunner } from './pnb-backfill-entities-fargate-batch-job'
import { PnbBackfillTransactionsBatchJobRunner } from './pnb-backfill-transactions-fargate-batch-job'
import { ManualRulePreAggregationBatchJobRunner } from './manual-rule-pre-aggregation-batch-job-runner'
import { PnbBackfillKrsBatchJobRunner } from './pnb-backfill-krs-fargate-batch-job'
import { PnbBackfillArsBatchJobRunner } from './pnb-backfill-ars-fargate-batch-job'
import { PnbBackfillCraBatchJobRunner } from './pnb-backfill-cra-fargate-batch-job'
import { PnbBackfillHammerheadBatchJobRunner } from './pnb-backfill-hammerhead-fargate-batch-job'
import { PnbBackfillWebhookDeliveriesBatchJobRunner } from './pnb-backfill-webhook-deliveries'
import { BackfillAsyncRuleRunsBatchJobRunner } from './backfill-async-rule-runs-batch-job'
import { FixRiskScoresForPnbUsersBatchJobRunner } from './fix-risk-scores-for-pnb-users'
import { WebhookRetryBatchJobRunner } from './webhook-retry-batch-job-runner'
import { NangoDataFetchBatchJobRunner } from './nango-data-fetch'
import { FinCenReportStatusFetchBatchJobRunner } from './fincen-report-status-fetch'
import { AggregationCleanupBatchJobRunner } from './aggregation-cleanup-batch-job-runner'
import { PnbTransactionUpdatesBatchJobRunner } from './pnb-transaction-updates'
import { InHouseScreeningMigrationBatchJobRunner } from './in-house-screening-migration-batch-job-runner'
import { SyncAuth0DataRunner } from './sync-auth0-data'
import { FailingBatchJobRunner } from './failing-batch-job-runner'
import { FixArsBreakdownBatchJobRunner } from './fix-ars-breakdown-batch-job-runner'
import { ClickhouseDataBatchJobRunner } from './clickhouse-data-batch-job-runner'
import { FixLocksForKrsBatchJobRunner } from './fix-locks-for-krs-batch-job-runner'
import { DeltaSanctionsDataFetchBatchJobRunner } from './delta-sanctions-batch-job-runner'
import { BatchJobType } from '@/@types/batch-job'
import { ApiUsageMetricsBatchJobRunner } from '@/services/batch-jobs/api-usage-metrics-batch-job-runner'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { DashboardRefreshBatchJobRunner } from '@/services/batch-jobs/dashboard-refresh-batch-job-runner'
import { DemoModeDataLoadJobRunner } from '@/services/batch-jobs/demo-mode-data-load-job-runner'
import { GlobalRuleAggregationRebuildBatchJobRunner } from '@/services/batch-jobs/global-rule-aggregation-rebuild-batch-job-runner'
import { OngoingScreeningUserRuleBatchJobRunner } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { PulseDataLoadJobRunner } from '@/services/batch-jobs/pulse-data-load-job-runner'
import { SimulationBeaconBatchJobRunner } from '@/services/batch-jobs/simulation-beacon-batch-job-runner'
import { SimulationRiskLevelsBatchJobRunner } from '@/services/batch-jobs/simulation-pulse-batch-job-runner'
import { SyncDatabases } from '@/services/batch-jobs/sync-mongo-indexes-job-runner'
import { TestFargateBatchJobRunner } from '@/services/batch-jobs/test-fargate-batch-job'
import { FilesAiSummaryBatchJobRunner } from '@/services/batch-jobs/files-ai-summary-batch-job-runner'
import { SanctionsDataFetchBatchJobRunner } from '@/services/batch-jobs/sanctions-data-fetch-job-runner'

type JobRunnerMap = Record<BatchJobType, (jobId) => BatchJobRunner>

export function getBatchJobRunner(type: BatchJobType, jobId: string) {
  const jobRunnerMap: JobRunnerMap = {
    DASHBOARD_REFRESH: (jobId) => new DashboardRefreshBatchJobRunner(jobId),
    API_USAGE_METRICS: (jobId) => new ApiUsageMetricsBatchJobRunner(jobId),
    DEMO_MODE_DATA_LOAD: (jobId) => new DemoModeDataLoadJobRunner(jobId),
    GLOBAL_RULE_AGGREGATION_REBUILD: (jobId) =>
      new GlobalRuleAggregationRebuildBatchJobRunner(jobId),
    ONGOING_SCREENING_USER_RULE: (jobId) =>
      new OngoingScreeningUserRuleBatchJobRunner(jobId),
    PULSE_USERS_BACKFILL_RISK_SCORE: (jobId) =>
      new PulseDataLoadJobRunner(jobId),
    SIMULATION_BEACON: (jobId) => new SimulationBeaconBatchJobRunner(jobId),
    SIMULATION_PULSE: (jobId) => new SimulationRiskLevelsBatchJobRunner(jobId),
    SYNC_DATABASES: (jobId) => new SyncDatabases(jobId),
    TEST_FARGATE: (jobId) => new TestFargateBatchJobRunner(jobId),
    TENANT_DELETION: (jobId) => new TenantDeletionBatchJobRunner(jobId),
    SIMULATION_RISK_FACTORS: (jobId) =>
      new SimulationRiskFactorsBatchJobRunner(jobId),
    RULE_PRE_AGGREGATION: (jobId) =>
      new RulePreAggregationBatchJobRunner(jobId),
    MANUAL_RULE_PRE_AGGREGATION: (jobId) =>
      new ManualRulePreAggregationBatchJobRunner(jobId),
    FILES_AI_SUMMARY: (jobId) => new FilesAiSummaryBatchJobRunner(jobId),
    ALERT_SLA_STATUS_REFRESH: (jobId) =>
      new AlertSLAStatusRefreshBatchJobRunner(jobId),
    REVERIFY_TRANSACTIONS: (jobId) =>
      new ReverifyTransactionsBatchJobRunner(jobId),
    SANCTIONS_DATA_FETCH: (jobId) =>
      new SanctionsDataFetchBatchJobRunner(jobId),
    BACKFILL_AVERAGE_TRS: (jobId) => new BackfillAvgTrsRunner(jobId),
    PNB_TRANSACTION_UPDATES: (jobId) =>
      new PnbTransactionUpdatesBatchJobRunner(jobId),
    RISK_SCORING_RECALCULATION: (jobId) =>
      new RiskScoringRecalculationBatchJobRunner(jobId),
    SIMULATION_RISK_FACTORS_V8: (jobId) =>
      new SimulationV8RiskFactorsBatchJobRunner(jobId),
    BACKFILL_ASYNC_RULE_RUNS: (jobId) =>
      new BackfillAsyncRuleRunsBatchJobRunner(jobId),
    PNB_BACKFILL_ENTITIES: (jobId) =>
      new PnbBackfillEntitiesBatchJobRunner(jobId),
    PNB_BACKFILL_TRANSACTIONS: (jobId) =>
      new PnbBackfillTransactionsBatchJobRunner(jobId),
    PNB_BACKFILL_KRS: (jobId) => new PnbBackfillKrsBatchJobRunner(jobId),
    PNB_BACKFILL_CRA: (jobId) => new PnbBackfillCraBatchJobRunner(jobId),
    PNB_BACKFILL_HAMMERHEAD: (jobId) =>
      new PnbBackfillHammerheadBatchJobRunner(jobId),
    PNB_BACKFILL_ARS: (jobId) => new PnbBackfillArsBatchJobRunner(jobId),
    CASE_SLA_STATUS_REFRESH: (jobId) =>
      new CaseSLAStatusRefreshBatchJobRunner(jobId),
    PNB_BACKFILL_WEBHOOK_DELIVERIES: (jobId) =>
      new PnbBackfillWebhookDeliveriesBatchJobRunner(jobId),
    FIX_RISK_SCORES_FOR_PNB_USERS: (jobId) =>
      new FixRiskScoresForPnbUsersBatchJobRunner(jobId),
    WEBHOOK_RETRY: (jobId) => new WebhookRetryBatchJobRunner(jobId),
    NANGO_DATA_FETCH: (jobId) => new NangoDataFetchBatchJobRunner(jobId),
    FINCEN_REPORT_STATUS_REFRESH: (jobId) =>
      new FinCenReportStatusFetchBatchJobRunner(jobId),
    AGGREGATION_CLEANUP: (jobId) => new AggregationCleanupBatchJobRunner(jobId),
    IN_HOUSE_SCREENING_MIGRATION: (jobId) =>
      new InHouseScreeningMigrationBatchJobRunner(jobId),
    SYNC_AUTH0_DATA: (jobId) => new SyncAuth0DataRunner(jobId),
    FAILING_BATCH_JOB: (jobId) => new FailingBatchJobRunner(jobId),
    FIX_ARS_BREAKDOWN: (jobId) => new FixArsBreakdownBatchJobRunner(jobId),
    CLICKHOUSE_DATA_BACKFILL: (jobId) =>
      new ClickhouseDataBatchJobRunner(jobId),
    FIX_LOCKS_FOR_KRS: (jobId) => new FixLocksForKrsBatchJobRunner(jobId),
    DELTA_SANCTIONS_DATA_FETCH: (jobId) =>
      new DeltaSanctionsDataFetchBatchJobRunner(jobId),
  }
  return jobRunnerMap[type](jobId)
}

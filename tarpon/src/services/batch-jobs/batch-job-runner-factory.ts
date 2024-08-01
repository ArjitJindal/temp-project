import { TenantDeletionBatchJobRunner } from './tenant-deletion-batch-job-runner'
import { SimulationRiskFactorsBatchJobRunner } from './simulation-risk-scoring-batch-job-runner'
import { RulePreAggregationBatchJobRunner } from './rule-pre-aggregation-batch-job-runner'
import { ReverifyTransactionsBatchJobRunner } from './reverify-transactions-job-runner'
import { BatchJobType } from '@/@types/batch-job'
import { ApiUsageMetricsBatchJobRunner } from '@/services/batch-jobs/api-usage-metrics-batch-job-runner'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { DashboardRefreshBatchJobRunner } from '@/services/batch-jobs/dashboard-refresh-batch-job-runner'
import { DemoModeDataLoadJobRunner } from '@/services/batch-jobs/demo-mode-data-load-job-runner'
import { FileImportBatchJobRunner } from '@/services/batch-jobs/file-import-batch-job-runner'
import { GlobalRuleAggregationRebuildBatchJobRunner } from '@/services/batch-jobs/global-rule-aggregation-rebuild-batch-job-runner'
import { OngoingMerchantMonitoringBatchJobRunner } from '@/services/batch-jobs/ongoing-merchant-monitoring-batch-job-runner'
import { OngoingScreeningUserRuleBatchJobRunner } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { PulseDataLoadJobRunner } from '@/services/batch-jobs/pulse-data-load-job-runner'
import { SimulationBeaconBatchJobRunner } from '@/services/batch-jobs/simulation-beacon-batch-job-runner'
import { SimulationRiskLevelsBatchJobRunner } from '@/services/batch-jobs/simulation-pulse-batch-job-runner'
import { SyncMongoDbIndexesBatchJobRunner } from '@/services/batch-jobs/sync-mongo-indexes-job-runner'
import { TestFargateBatchJobRunner } from '@/services/batch-jobs/test-fargate-batch-job'
import { FilesAiSummaryBatchJobRunner } from '@/services/batch-jobs/files-ai-summary-batch-job-runner'

type JobRunnerMap = Record<BatchJobType, (jobId) => BatchJobRunner>

export function getBatchJobRunner(type: BatchJobType, jobId: string) {
  const jobRunnerMap: JobRunnerMap = {
    DASHBOARD_REFRESH: (jobId) => new DashboardRefreshBatchJobRunner(jobId),
    API_USAGE_METRICS: (jobId) => new ApiUsageMetricsBatchJobRunner(jobId),
    DEMO_MODE_DATA_LOAD: (jobId) => new DemoModeDataLoadJobRunner(jobId),
    FILE_IMPORT: (jobId) => new FileImportBatchJobRunner(jobId),
    GLOBAL_RULE_AGGREGATION_REBUILD: (jobId) =>
      new GlobalRuleAggregationRebuildBatchJobRunner(jobId),
    ONGOING_SCREENING_USER_RULE: (jobId) =>
      new OngoingScreeningUserRuleBatchJobRunner(jobId),
    PULSE_USERS_BACKFILL_RISK_SCORE: (jobId) =>
      new PulseDataLoadJobRunner(jobId),
    SIMULATION_BEACON: (jobId) => new SimulationBeaconBatchJobRunner(jobId),
    SIMULATION_PULSE: (jobId) => new SimulationRiskLevelsBatchJobRunner(jobId),
    ONGOING_MERCHANT_MONITORING: (jobId) =>
      new OngoingMerchantMonitoringBatchJobRunner(jobId),
    SYNC_INDEXES: (jobId) => new SyncMongoDbIndexesBatchJobRunner(jobId),
    TEST_FARGATE: (jobId) => new TestFargateBatchJobRunner(jobId),
    TENANT_DELETION: (jobId) => new TenantDeletionBatchJobRunner(jobId),
    SIMULATION_RISK_FACTORS: (jobId) =>
      new SimulationRiskFactorsBatchJobRunner(jobId),
    RULE_PRE_AGGREGATION: (jobId) =>
      new RulePreAggregationBatchJobRunner(jobId),
    FILES_AI_SUMMARY: (jobId) => new FilesAiSummaryBatchJobRunner(jobId),
    REVERIFY_TRANSACTIONS: (jobId) =>
      new ReverifyTransactionsBatchJobRunner(jobId),
  }
  return jobRunnerMap[type](jobId)
}

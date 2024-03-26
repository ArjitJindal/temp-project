import { TenantDeletionBatchJobRunner } from './tenant-deletion-batch-job-runner'
import { SimulationRiskFactorsBatchJobRunner } from './simulation-risk-scoring-batch-job-runner'
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

type JobRunnerMap = Record<BatchJobType, BatchJobRunner>

export function getBatchJobRunner(type: BatchJobType) {
  const jobRunnerMap: JobRunnerMap = {
    DASHBOARD_REFRESH: new DashboardRefreshBatchJobRunner(),
    API_USAGE_METRICS: new ApiUsageMetricsBatchJobRunner(),
    DEMO_MODE_DATA_LOAD: new DemoModeDataLoadJobRunner(),
    FILE_IMPORT: new FileImportBatchJobRunner(),
    GLOBAL_RULE_AGGREGATION_REBUILD:
      new GlobalRuleAggregationRebuildBatchJobRunner(),
    ONGOING_SCREENING_USER_RULE: new OngoingScreeningUserRuleBatchJobRunner(),
    PULSE_USERS_BACKFILL_RISK_SCORE: new PulseDataLoadJobRunner(),
    SIMULATION_BEACON: new SimulationBeaconBatchJobRunner(),
    SIMULATION_PULSE: new SimulationRiskLevelsBatchJobRunner(),
    ONGOING_MERCHANT_MONITORING: new OngoingMerchantMonitoringBatchJobRunner(),
    SYNC_INDEXES: new SyncMongoDbIndexesBatchJobRunner(),
    TEST_FARGATE: new TestFargateBatchJobRunner(),
    TENANT_DELETION: new TenantDeletionBatchJobRunner(),
    SIMULATION_RISK_FACTORS: new SimulationRiskFactorsBatchJobRunner(),
  }
  return jobRunnerMap[type]
}

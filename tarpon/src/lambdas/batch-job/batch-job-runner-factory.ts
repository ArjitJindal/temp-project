import { FileImportBatchJobRunner } from './file-import-batch-job-runner'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationPulseBatchJobRunner } from './simulation-pulse-batch-job-runner'
import { OngoingScreeningUserRuleBatchJobRunner } from './ongoing-screening-user-rule-batch-job-runner'
import { DemoModeDataLoadJobRunner } from './demo-mode-data-load-job-runner'
import { SimulationBeaconBatchJobRunner } from './simulation-beacon-batch-job-runner'
import { PulseDataLoadJobRunner } from './pulse-data-load-job-runner'
import { ApiUsageMetricsBatchJobRunner } from './api-usage-metrics-batch-job-runner'
import { GlobalRuleAggregationRebuildBatchJobRunner } from './global-rule-aggregation-rebuild-batch-job-runner'
import { OngoingMerchantMonitoringBatchJobRunner } from './ongoing-merchant-monitoring-batch-job-runner'
import { SyncMongoDbIndexesBatchJobRunner } from './sync-mongo-indexes-job-runner'
import { BatchJobType } from '@/@types/batch-job'
import { DashboardRefreshBatchJobRunner } from '@/lambdas/batch-job/dashboard-refresh-batch-job-runner'

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
    SIMULATION_PULSE: new SimulationPulseBatchJobRunner(),
    ONGOING_MERCHANT_MONITORING: new OngoingMerchantMonitoringBatchJobRunner(),
    SYNC_INDEXES: new SyncMongoDbIndexesBatchJobRunner(),
  }
  return jobRunnerMap[type]
}

import { FileImportBatchJobRunner } from './file-import-batch-job-runner'
import { PlaceholderBatchJobRunner } from './placeholder-batch-job-runner'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationPulseBatchJobRunner } from './simulation-pulse-batch-job-runner'
import { OngoingScreeningUserRuleBatchJobRunner } from './ongoing-screening-user-rule-batch-job-runner'
import { DemoModeDataLoadJobRunner } from './demo-mode-data-load-job-runner'
import { SimulationBeaconBatchJobRunner } from './simulation-beacon-batch-job-runner'
import { PulseDataLoadJobRunner } from './pulse-data-load-job-runner'
import { BatchJobType } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { neverReturn } from '@/utils/lang'

export class BatchJobRunnerFactory {
  public static getBatchJobRunner(type: BatchJobType): BatchJobRunner {
    switch (type) {
      case 'FILE_IMPORT':
        return new FileImportBatchJobRunner()
      case 'SIMULATION_PULSE':
        return new SimulationPulseBatchJobRunner()
      case 'SIMULATION_BEACON':
        return new SimulationBeaconBatchJobRunner()
      case 'DEMO_MODE_DATA_LOAD':
        return new DemoModeDataLoadJobRunner()
      case 'PLACEHOLDER':
        return new PlaceholderBatchJobRunner()
      case 'ONGOING_SCREENING_USER_RULE':
        return new OngoingScreeningUserRuleBatchJobRunner()
      case 'PULSE_USERS_BACKFILL_RISK_SCORE':
        return new PulseDataLoadJobRunner()
      default: {
        logger.warn(`Unknown batch job type ${type}. Do nothing.`)
        return neverReturn(type, new PlaceholderBatchJobRunner())
      }
    }
  }
}

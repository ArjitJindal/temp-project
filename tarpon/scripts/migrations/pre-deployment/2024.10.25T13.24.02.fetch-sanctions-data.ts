import { SanctionsDataFetchBatchJobRunner } from '@/services/batch-jobs/sanctions-data-fetch-job-runner'

export const up = async () => {
  const runner = new SanctionsDataFetchBatchJobRunner('')
  await runner.run({
    type: 'SANCTIONS_DATA_FETCH',
    tenantId: 'flagright',
    parameters: {},
  })
}
export const down = async () => {
  // skip
}

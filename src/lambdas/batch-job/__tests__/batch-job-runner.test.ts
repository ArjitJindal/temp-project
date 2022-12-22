import { jobRunnerHandler } from '../app'
import { PlaceholderBatchJob } from '@/@types/batch-job'

describe('Batch job runner', () => {
  test('uses the correct job runner and runs the job', async () => {
    const testJob: PlaceholderBatchJob = {
      type: 'PLACEHOLDER',
      tenantId: 'test',
    }
    expect(await jobRunnerHandler(testJob)).toEqual('PLACEHOLDER_JOB_OUTPUT')
  })
})

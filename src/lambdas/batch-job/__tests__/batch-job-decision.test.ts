import { jobDecisionHandler } from '../app'
import { PlaceholderBatchJob } from '@/@types/batch-job'

test('returns batch job run type', async () => {
  const testJob: PlaceholderBatchJob = { type: 'PLACEHOLDER', tenantId: 'test' }
  expect(await jobDecisionHandler(testJob)).toEqual({
    BatchJobRunType: 'LAMBDA',
    BatchJobPayload: testJob,
  })
})

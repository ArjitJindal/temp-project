import { jobRunnerHandler } from '../app'
import { LiveTestingPulseBatchJob } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { LiveTestingTaskRepository } from '@/lambdas/console-api-live-testing/repositories/live-testing-task-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { LiveTestPulseParameters } from '@/@types/openapi-internal/LiveTestPulseParameters'

describe('Live testing (Pulse) batch job runner', () => {
  test('runs the job', async () => {
    const tenantId = getTestTenantId()
    const mongoDb = await getMongoDbClient()
    const parameters: LiveTestPulseParameters = {
      type: 'PULSE',
      classificationValues: [],
      parameterAttributeRiskValues: [],
      sampling: {
        usersCount: 100,
      },
    }
    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )
    const taskId = await liveTestingTaskRepository.createLiveTestingTask(
      parameters
    )
    const testJob: LiveTestingPulseBatchJob = {
      type: 'LIVE_TESTING_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId,
        ...parameters,
      },
    }

    await jobRunnerHandler(testJob)

    expect(
      await liveTestingTaskRepository.getLiveTestingTask(taskId)
    ).toMatchObject({
      progress: 1,
      statistics: [],
      latestStatus: { status: 'SUCCESS', timestamp: expect.any(Number) },
      statuses: [
        { status: 'PENDING', timestamp: expect.any(Number) },
        { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
        { status: 'SUCCESS', timestamp: expect.any(Number) },
      ],
    })
  })
})

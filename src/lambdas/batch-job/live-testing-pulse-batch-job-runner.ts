import { LiveTestingTaskRepository } from '../console-api-live-testing/repositories/live-testing-task-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { LiveTestingPulseBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export class LiveTestingPulseBatchJobRunner extends BatchJobRunner {
  public async run(job: LiveTestingPulseBatchJob) {
    const { tenantId, parameters } = job
    const mongoDb = await getMongoDbClient()
    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )
    await liveTestingTaskRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )
    // TODO: Implement live testing logic
    await liveTestingTaskRepository.updateTaskStatus(
      parameters.taskId,
      'SUCCESS'
    )
  }
}

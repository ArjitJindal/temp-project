import { FlatFilesService } from '../flat-files'
import { BatchJobRunner } from './batch-job-runner-base'
import { FlatFilesRunnerBatchJob } from '@/@types/batch-job'

export class FlatFilesRunnerBatchJobRunner extends BatchJobRunner {
  async run(job: FlatFilesRunnerBatchJob) {
    const { tenantId, parameters } = job

    const flatFilesService = new FlatFilesService(tenantId)
    await flatFilesService.run(
      parameters.schema,
      parameters.format,
      parameters.s3Key,
      parameters.metadata ?? {},
      parameters.entityId
    )
  }
}

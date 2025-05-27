import { BatchJobRunner } from './batch-job-runner-base'
import { FlatFilesValidationBatchJob } from '@/@types/batch-job'
import { FlatFilesService } from '@/services/flat-files'
import { logger } from '@/core/logger'

export class FlatFilesValidationBatchJobRunner extends BatchJobRunner {
  async run(job: FlatFilesValidationBatchJob) {
    const { tenantId, parameters } = job
    const flatFilesService = new FlatFilesService(tenantId)
    const { s3Key, schema, format } = parameters
    const _isAllValid = await flatFilesService.validateAndStoreRecords(
      schema,
      format,
      s3Key
    )

    if (!_isAllValid) {
      logger.error(
        `Flat files validation failed for ${s3Key} with schema ${schema} and format ${format}`
      )
    }
  }
}

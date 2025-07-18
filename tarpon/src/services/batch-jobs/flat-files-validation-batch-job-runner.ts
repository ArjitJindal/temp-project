import { BatchJobRunner } from './batch-job-runner-base'
import { sendBatchJobCommand } from './batch-job'
import { FlatFilesValidationBatchJob } from '@/@types/batch-job'
import { FlatFilesService } from '@/services/flat-files'
import { logger } from '@/core/logger'

export class FlatFilesValidationBatchJobRunner extends BatchJobRunner {
  async run(job: FlatFilesValidationBatchJob) {
    const { tenantId, parameters } = job
    const flatFilesService = new FlatFilesService(tenantId)
    const { s3Key, schema, format, metadata, entityId } = parameters
    const _isAllValid = await flatFilesService.validateAndStoreRecords(
      schema,
      format,
      s3Key,
      metadata
    )

    if (!_isAllValid) {
      logger.warn(
        `Flat files validation failed for ${s3Key} with schema ${schema} and format ${format}`
      )
    }

    await sendBatchJobCommand({
      tenantId,
      type: 'FLAT_FILES_RUNNER',
      parameters: {
        s3Key,
        entityId,
        metadata,
        schema,
        format,
      },
    })
  }
}

import { CaseClosure } from '@/@types/openapi-internal/CaseClosure'
import { FlatFileRunner } from '@/services/flat-files/runner'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import {
  FlatFilesRecordsSchema,
  FlatFileValidationResult,
} from '@/@types/flat-files'
import { CaseRepository } from '@/services/cases/repository'
import { CaseService } from '@/services/cases'
import { getS3Client } from '@/utils/s3'
import { memoizePromise } from '@/utils/memoize'

@traceable
export class BulkCaseClosureRunner extends FlatFileRunner<CaseClosure> {
  model = CaseClosure
  public concurrency = 10

  async validate(
    data: CaseClosure
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    const { caseId, comment, reason } = data
    if (!caseId || !comment || !reason) {
      throw new Error('Case ID, comment and reason are required')
    }

    logger.info(
      `Validating case closure for case ${caseId}, comment: ${comment}, reason: ${reason}`
    )

    return {
      valid: true,
      errors: [],
    }
  }

  private getCaseService = memoizePromise(async () => {
    const caseRepository = new CaseRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const s3 = getS3Client()

    const caseService = new CaseService(caseRepository, s3, {
      documentBucketName: process.env.DOCUMENT_BUCKET as string,
      tmpBucketName: process.env.TMP_BUCKET as string,
    })

    return caseService
  })

  async _run(
    data: CaseClosure,
    _metadata: Omit<FlatFilesRecordsSchema, 'record'>
  ): Promise<void> {
    const caseService = await this.getCaseService()
    logger.info(`Updating case ${data.caseId}`)
    await caseService.updateStatus([data.caseId], {
      caseStatus: 'CLOSED',
      reason: [data.reason],
      comment: data.comment,
    })
    logger.info(`Updated case ${data.caseId}`)
  }
}

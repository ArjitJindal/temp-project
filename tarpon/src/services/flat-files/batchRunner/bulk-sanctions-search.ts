import memoize from 'lodash/memoize'
import pMap from 'p-map'
import { FlatFileRunner } from '../runner'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { FlatFileValidationResult } from '@/@types/flat-files'
import { SanctionsService } from '@/services/sanctions'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { SanctionsBulkUploadSchema } from '@/@types/openapi-internal/SanctionsBulkUploadSchema'

type BulkSearchRecord = {
  name: string
  [key: string]: any
}

@traceable
export class BulkSanctionsSearchRunner extends FlatFileRunner<BulkSearchRecord> {
  model = SanctionsBulkUploadSchema
  public concurrency = 10

  private getSanctionsService = memoize(() => {
    return new SanctionsService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
  })

  async validate(
    data: BulkSearchRecord
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    if (
      !data.name ||
      typeof data.name !== 'string' ||
      data.name.trim() === ''
    ) {
      return {
        valid: false,
        errors: [
          {
            message: 'Name field is required and must be a non-empty string',
            keyword: 'NAME_REQUIRED',
            stage: 'VALIDATE',
          },
        ],
      }
    }

    return {
      valid: true,
      errors: [],
    }
  }

  async _run(
    data: BulkSearchRecord,
    recordMetaData: any,
    metadata: any
  ): Promise<void> {
    const { batchId, searchTermId, bulkSearchRequest, searchedBy } =
      metadata as {
        batchId: string
        searchTermId: string
        bulkSearchRequest: SanctionsSearchRequest
        searchedBy?: string
      }

    if (!searchTermId) {
      throw new Error('searchTermId is required in metadata')
    }

    const sanctionsService = this.getSanctionsService()
    const searchTerm = data.name
    const searchRequest: SanctionsSearchRequest = {
      ...bulkSearchRequest,
      searchTerm: searchTerm,
    }
    const searchResponse = await sanctionsService.search(searchRequest, {
      batchId,
      searchTermId,
      searchedBy,
    })
    await sanctionsService.saveBulkSearchResultMap(
      batchId,
      searchResponse.searchId,
      searchTermId,
      searchTerm
    )
    logger.info(
      `Completed search for searchTermId: ${searchTermId}, searchId: ${searchResponse.searchId}`
    )
  }

  protected async processBatch(
    batch: Array<any>,
    metadata: object,
    entityId?: string
  ): Promise<void> {
    const batchId = entityId

    if (!batchId) {
      throw new Error(
        'entityId is required in metadata for bulk sanctions search'
      )
    }

    logger.info(
      `Processing batch of ${batch.length} records for batchId: ${batchId}`
    )

    // Fetch bulk search history once for the entire batch
    const sanctionsService = this.getSanctionsService()
    const bulkSearchHistory = await sanctionsService.getBulkSearch(batchId)

    if (!bulkSearchHistory) {
      throw new Error(`Bulk search request not found for batchId: ${batchId}`)
    }

    const bulkSearchRequest = bulkSearchHistory.request
    const searchedBy = bulkSearchHistory.createdBy

    // Assign sequential searchTermIds before processing using row numbers
    // For BS-001: BS-001.1, BS-001.2, BS-001.3, etc.
    // For BS-002: BS-002.1, BS-002.2, BS-002.3, etc.
    const recordsWithIds = batch.map((record) => {
      const searchTermId = `${batchId}.${record.row + 1}`
      return { record, searchTermId }
    })

    // Process records in parallel with controlled concurrency
    await pMap(
      recordsWithIds,
      async ({ record, searchTermId }) => {
        try {
          const sanitized = await this.sanitizeRecord(record)
          if (sanitized) {
            await this._run(sanitized.data, sanitized.schema, {
              ...metadata,
              batchId: batchId,
              searchTermId,
              bulkSearchRequest,
              searchedBy,
            })
            await this.updateRecordStatus(sanitized.schema, true)
          }
        } catch (error) {
          logger.error(`Failed to process record in batch`, {
            error,
            recordId: `${record.fileId}:${record.row}`,
            batchId,
            searchTermId,
          })
          await this.updateRecordStatus(record, true, [this.formatError(error)])
        }
      },
      { concurrency: this.concurrency }
    )

    logger.info(
      `Completed processing batch of ${batch.length} records for batchId: ${batchId}`
    )
  }
}

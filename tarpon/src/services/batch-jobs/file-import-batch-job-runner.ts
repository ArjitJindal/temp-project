import { ImportService } from '../import'
import { BatchJobRunner } from './batch-job-runner-base'
import { FileImportBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3Client } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { assertPermissions } from '@/@types/jwt'
import { assertUserError } from '@/utils/errors'
import { traceable } from '@/core/xray'
import { FileImportConfig } from '@/lambdas/console-api-file-import/app'
import { Importer } from '@/lambdas/console-api-file-import/importer'

const { TMP_BUCKET, IMPORT_BUCKET } = process.env as FileImportConfig

@traceable
export class FileImportBatchJobRunner extends BatchJobRunner {
  protected async run(job: FileImportBatchJob): Promise<void> {
    const { tenantId, parameters, awsCredentials } = job
    const { tenantName, importRequest } = parameters
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const s3 = getS3Client(awsCredentials)
    const mongoDb = await getMongoDbClient()
    const importService = new ImportService(tenantId, {
      mongoDb,
    })

    const importer = new Importer(
      tenantId,
      tenantName,
      { dynamoDb, s3, mongoDb },
      TMP_BUCKET,
      IMPORT_BUCKET
    )
    let importedCount = 0
    const importId = importRequest.s3Key.replace(/\//g, '')
    await importService.createFileImport({
      _id: importId,
      type: importRequest.type,
      s3Key: importRequest.s3Key,
      filename: importRequest.filename,
      statuses: [{ status: 'IN_PROGRESS', timestamp: Date.now() }],
    })
    try {
      if (importRequest.type === 'TRANSACTION') {
        assertPermissions(['transactions:import:write'])
        importedCount = await importer.importTransactions(importRequest)
      } else if (importRequest.type === 'USER') {
        assertPermissions(['users:import:write'])
        importedCount = await importer.importConsumerUsers(importRequest)
      } else if (importRequest.type === 'BUSINESS') {
        assertPermissions(['users:import:write'])
        importedCount = await importer.importBusinessUsers(importRequest)
      }
      await importService.completeFileImport(importId, importedCount)
    } catch (e) {
      await importService.failFileImport(
        importId,
        e instanceof Error ? e.message : 'Unknown'
      )
      assertUserError(e)
    }
  }
}

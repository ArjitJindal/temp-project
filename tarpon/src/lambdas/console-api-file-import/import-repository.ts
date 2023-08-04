import { MongoClient } from 'mongodb'
import { Credentials } from 'aws-lambda'
import { IMPORT_COLLECTION } from '@/utils/mongoDBUtils'
import { FileImport } from '@/@types/openapi-internal/FileImport'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { sendBatchJobCommand } from '@/services/batch-job'
import { FileImportBatchJob } from '@/@types/batch-job'

export class ImportRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async createFileImport(fileImport: FileImport) {
    const db = this.mongoDb.db()
    const collection = db.collection(IMPORT_COLLECTION(this.tenantId))
    await collection.replaceOne(
      {
        _id: fileImport._id as any,
      },
      fileImport,
      { upsert: true }
    )
  }

  public async completeFileImport(importId: string, importedRecords: number) {
    const db = this.mongoDb.db()
    const collection = db.collection<FileImport>(
      IMPORT_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { _id: importId },
      {
        $set: { importedRecords },
        $push: { statuses: { status: 'SUCCESS', timestamp: Date.now() } },
      }
    )
  }
  public async failFileImport(importId: string, error: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<FileImport>(
      IMPORT_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { _id: importId },
      {
        $set: { error },
        $push: { statuses: { status: 'FAILED', timestamp: Date.now() } },
      }
    )
  }

  public async getFileImport(importId: string): Promise<FileImport> {
    const db = this.mongoDb.db()
    const collection = db.collection<FileImport>(
      IMPORT_COLLECTION(this.tenantId)
    )
    const data = await collection.findOne({ _id: importId })
    if (!data) {
      throw new Error(`File import ${importId} not found`)
    }
    return data
  }

  public async postFileImport(
    importRequest: ImportRequest,
    tenantName: string,
    awsCredentials?: Credentials
  ) {
    await sendBatchJobCommand(this.tenantId, {
      type: 'FILE_IMPORT',
      parameters: {
        tenantName,
        importRequest,
      },
      awsCredentials,
    } as FileImportBatchJob)
  }
}

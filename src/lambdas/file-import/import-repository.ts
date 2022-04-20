import { TarponStackConstants } from '@cdk/constants'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { IMPORT_COLLECTION } from '@/utils/mongoDBUtils'
import { FileImport } from '@/@types/openapi-internal/FileImport'

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
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection(IMPORT_COLLECTION(this.tenantId))
    await collection.replaceOne(
      {
        _id: fileImport._id,
      },
      fileImport,
      { upsert: true }
    )
  }

  public async completeFileImport(importId: string, importedRecords: number) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
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
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
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

  public async getFileImport(importId: string): Promise<FileImport | null> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<FileImport>(
      IMPORT_COLLECTION(this.tenantId)
    )
    return collection.findOne({ _id: importId })
  }
}

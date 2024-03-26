import { MongoClient } from 'mongodb'
import { Credentials } from 'aws-lambda'
import { ImportRepository } from './import-repository'
import { traceable } from '@/core/xray'
import { FileImport } from '@/@types/openapi-internal/FileImport'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'

@traceable
export class ImportService {
  mongoDb: MongoClient
  tenantId: string
  importRepository: ImportRepository

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.mongoDb = connections.mongoDb
    this.tenantId = tenantId
    this.importRepository = new ImportRepository(tenantId, connections)
  }

  public async createFileImport(fileImport: FileImport) {
    await this.importRepository.createFileImport(fileImport)
  }

  public async completeFileImport(importId: string, importedRecords: number) {
    await this.importRepository.completeFileImport(importId, importedRecords)
  }

  public async failFileImport(importId: string, error: string) {
    await this.importRepository.failFileImport(importId, error)
  }

  public async getFileImport(importId: string): Promise<FileImport> {
    return await this.importRepository.getFileImport(importId)
  }

  public async postFileImport(
    importRequest: ImportRequest,
    tenantName: string,
    awsCredentials?: Credentials
  ) {
    await this.importRepository.postFileImport(
      importRequest,
      tenantName,
      awsCredentials
    )
  }
}

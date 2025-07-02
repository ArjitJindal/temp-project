import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { ClickHouseClient } from '@clickhouse/client'
import { FlatFileBatchRunner } from '.'
import {
  FlatFilesRecordsSchema,
  FlatFileValidationResult,
} from '@/@types/flat-files'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { sendAsyncRuleTasks } from '@/services/rules-engine/utils'
import { TransactionService } from '@/lambdas/console-api-transaction/services/transaction-service'
import { getS3Client } from '@/utils/s3'
import { TransactionViewConfig } from '@/lambdas/console-api-transaction/app'
import { Transaction } from '@/@types/openapi-public/Transaction'

export class TransactionUploadRunner extends FlatFileBatchRunner<Transaction> {
  public model = Transaction
  public concurrency = 20
  public transactionService: TransactionService

  constructor(
    tenantId: string,
    connections: {
      dynamoDb: DynamoDBDocumentClient
      mongoDb: MongoClient
      clickhouseClient: ClickHouseClient
      clickhouseConnectionConfig: ConnectionCredentials
    }
  ) {
    super(tenantId, connections)
    const s3 = getS3Client()
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as TransactionViewConfig
    this.transactionService = new TransactionService(
      tenantId,
      { mongoDb: connections.mongoDb, dynamoDb: connections.dynamoDb },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
  }

  public async batchRun(
    batchId: string,
    records: { data: InternalTransaction; schema: FlatFilesRecordsSchema }[]
  ): Promise<void> {
    await sendAsyncRuleTasks(
      records.map((v) => ({
        type: 'TRANSACTION_BATCH',
        transaction: v.data,
        tenantId: this.tenantId,
        batchId: batchId,
      })),
      false
    )
  }
  async validate(
    data: InternalTransaction
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    const transactionId = data.transactionId
    try {
      const transaction = await this.transactionService.getTransaction(
        transactionId
      )
      if (transaction) {
        return {
          valid: false,
          errors: [
            {
              message: `Transaction ${transactionId} already exists`,
              keyword: 'TRANSACTION_ALREADY_EXISTS',
              stage: 'VALIDATE_STORE',
            },
          ],
        }
      }
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof NotFound) {
        return { valid: true, errors: [] }
      }
      throw { valid: false, errors: error, stage: 'VALIDATE_STORE' }
    }
  }
}

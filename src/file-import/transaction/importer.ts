import { parse } from '@fast-csv/parse'
import * as createError from 'http-errors'
import { TarponStackConstants } from '../../../lib/constants'
import { Transaction } from '../../@types/openapi/transaction'
import { TransactionMonitoringResult } from '../../@types/openapi/transactionMonitoringResult'
import { verifyTransaction } from '../../rules-engine/app'
import { converters, ImportFormat } from './converters'

export type TransactionImportRequest = {
  type: 'TRANSACTION'
  format: ImportFormat
  key: string
}

export class TransactionImporter {
  tenantId: string
  dynamoDb: AWS.DynamoDB.DocumentClient
  s3: AWS.S3

  constructor(
    tenantId: string,
    dynamoDb: AWS.DynamoDB.DocumentClient,
    s3: AWS.S3
  ) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.s3 = s3
  }

  public async importTransactions(
    importRequest: TransactionImportRequest
  ): Promise<number> {
    const { key, format } = importRequest
    const converter = converters[format]
    if (!converter) {
      throw new Error(`Unknown import format: ${format}`)
    }

    let importedTransactions = 0
    const params = {
      Bucket: TarponStackConstants.S3_IMPORT_TMP_BUCKET,
      Key: key,
    }
    const stream = this.s3
      .getObject(params)
      .createReadStream()
      .pipe(parse(converter.getCsvParserOptions()))

    for await (const rawTransaction of stream) {
      const validationResult = converter.validate(rawTransaction)
      if (validationResult.length > 0) {
        throw new createError.BadRequest(validationResult.join(', '))
      }
      const transaction = converter.convert(rawTransaction)
      if (transaction) {
        const transactionResult = await this.importTransaction(transaction)
        importedTransactions += 1
        console.log(
          `Imported transaction (id=${transactionResult.transactionId})`
        )
      }
    }
    await this.s3
      .copyObject({
        CopySource: `${TarponStackConstants.S3_IMPORT_TMP_BUCKET}/${key}`,
        Bucket: TarponStackConstants.S3_IMPORT_BUCKET,
        Key: key,
      })
      .promise()
    return importedTransactions
  }

  private async importTransaction(
    transaction: Transaction
  ): Promise<TransactionMonitoringResult> {
    return await verifyTransaction(transaction, this.tenantId, this.dynamoDb)
  }
}

import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Currency } from '@/utils/currency-utils'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskLevelFromScore } from '@/services/risk-scoring/utils'

export class TransactionService {
  transactionRepository: MongoDbTransactionRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string
  riskRepository: RiskRepository

  constructor(
    transactionRepository: MongoDbTransactionRepository,
    riskRepository: RiskRepository,
    s3: AWS.S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.transactionRepository = transactionRepository
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
    this.riskRepository = riskRepository
  }

  public async getTransactions(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionsListResponse> {
    const result = await this.transactionRepository.getTransactions(params)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    result.data = result.data.map((transaction) => {
      if (transaction?.arsScore?.arsScore != null) {
        transaction.arsScore.riskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          transaction.arsScore.arsScore
        )
      }

      return transaction
    })

    return result
  }

  public async getStatsByType(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTypesResponse['data']> {
    return await this.transactionRepository.getStatsByType(
      params,
      referenceCurrency
    )
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    return await this.transactionRepository.getStatsByTime(
      params,
      referenceCurrency
    )
  }

  public async getTransaction(
    transactionId: string
  ): Promise<InternalTransaction | null> {
    const transaction = await this.transactionRepository.getInternalTransaction(
      transactionId
    )
    return transaction
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }

  public async getUniques(params: {
    field: TransactionsUniquesField
    direction: 'origin' | 'destination'
    filter?: string
  }): Promise<string[]> {
    return await this.transactionRepository.getUniques(params)
  }
}

import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import {
  DefaultApiGetTransactionsListRequest,
  DefaultApiGetTransactionsV2ListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { traceable } from '@/core/xray'
import { OptionalPagination } from '@/utils/pagination'
import { Currency } from '@/services/currency'
import { TransactionsResponse } from '@/@types/openapi-internal/TransactionsResponse'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { ClickhouseTransactionsRepository } from '@/services/rules-engine/repositories/clickhouse-repository'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'

@traceable
export class TransactionService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  s3: S3
  documentBucketName: string
  tmpBucketName: string
  riskRepository: RiskRepository
  transactionRepository: MongoDbTransactionRepository
  transactionEventsRepository: TransactionEventRepository
  userRepository: UserRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    s3: S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      connections.mongoDb
    )
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
    this.riskRepository = new RiskRepository(tenantId, connections)
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.transactionEventsRepository = new TransactionEventRepository(
      tenantId,
      connections
    )
    this.userRepository = new UserRepository(tenantId, connections)
  }

  public async getTransactionsCount(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    return await this.transactionRepository.getTransactionsCount(params)
  }

  public async getTransactionsListV2(
    params: DefaultApiGetTransactionsV2ListRequest
  ): Promise<TransactionsResponseOffsetPaginated> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const clickhouseTransactionsRepository =
      new ClickhouseTransactionsRepository(this.tenantId, clickhouseClient)

    const data = await clickhouseTransactionsRepository.getTransactions(params)

    if (params.includeUsers) {
      data.items = await this.getTransactionUsers(data.items)
    }

    return data
  }

  public async getTransactionsList(
    params: DefaultApiGetTransactionsListRequest,
    options: { includeEvents?: boolean; includeUsers?: boolean }
  ): Promise<TransactionsResponse> {
    const { includeEvents, includeUsers } = options
    const response = await this.getTransactions(params)

    if (includeUsers) {
      response.items = await this.getTransactionUsers(response.items)
    }

    if (includeEvents) {
      const events =
        await this.transactionEventsRepository.getMongoTransactionEvents(
          response.items.map((t) => t.transactionId)
        )
      response.items.map((t) => {
        t.events = events.get(t.transactionId)
        return t
      })
    }
    return response
  }

  private async getTransactionUsers(
    transaction: InternalTransaction[]
  ): Promise<InternalTransaction[]> {
    const userIds = Array.from(
      new Set<string>(
        transaction.flatMap(
          (t) =>
            [t.originUserId, t.destinationUserId].filter(Boolean) as string[]
        )
      )
    )

    const users = await this.userRepository.getMongoUsersByIds(userIds, {
      projection: {
        type: 1,
        'userDetails.name': 1,
        'legalEntity.companyGeneralDetails.legalName': 1,
        userId: 1,
      },
    })

    const userMap = new Map()
    users.forEach((u) => userMap.set(u.userId, u))

    transaction.map((t) => {
      t.originUser = userMap.get(t.originUserId)
      t.destinationUser = userMap.get(t.destinationUserId)
      return t
    })

    return transaction
  }

  public async getTransactions(params: DefaultApiGetTransactionsListRequest) {
    const result =
      await this.transactionRepository.getTransactionsCursorPaginate(params)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    result.items = result.items.map((transaction) => {
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

  public getTransactionCursor(params: DefaultApiGetTransactionsListRequest) {
    return this.transactionRepository.getTransactionsCursor(params)
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
    referenceCurrency: Currency,
    aggregateBy: 'status' | 'transactionState'
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    return await this.transactionRepository.getStatsByTime(
      params,
      referenceCurrency,
      aggregateBy
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

  public async getUniques(params: {
    field: TransactionsUniquesField
    direction: 'origin' | 'destination'
    filter?: string
  }): Promise<string[]> {
    return await this.transactionRepository.getUniques(params)
  }
}

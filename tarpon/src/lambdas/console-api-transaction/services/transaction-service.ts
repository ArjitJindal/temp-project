import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import compact from 'lodash/compact'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { TransactionViewConfig } from '../app'
import {
  DefaultApiGetAlertTransactionListRequest,
  DefaultApiGetCaseTransactionsRequest,
  DefaultApiGetTransactionsListRequest,
  DefaultApiGetTransactionsStatsByTimeRequest,
  DefaultApiGetTransactionsStatsByTypeRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { traceable } from '@/core/xray'
import {
  CursorPaginationResponse,
  OptionalPagination,
} from '@/utils/pagination'
import { Currency, CurrencyService } from '@/services/currency'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { ClickhouseTransactionsRepository } from '@/services/rules-engine/repositories/clickhouse-repository'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'
import { TransactionTableItem } from '@/@types/openapi-internal/TransactionTableItem'
import { getUserName } from '@/utils/helpers'
import { AlertsRepository } from '@/services/alerts/repository'
import { CaseRepository } from '@/services/cases/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3ClientByEvent } from '@/utils/s3'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TableListViewEnum } from '@/@types/openapi-internal/TableListViewEnum'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { Alert } from '@/@types/openapi-internal/Alert'
import { LinkerService } from '@/services/linker'
import { TransactionFlatFileUploadRequest } from '@/@types/openapi-internal/TransactionFlatFileUploadRequest'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { S3Service } from '@/services/aws/s3-service'

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
  private s3Service: S3Service

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    s3: S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      connections.mongoDb,
      connections.dynamoDb
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
    this.s3Service = new S3Service(s3 as S3, {
      documentBucketName: this.documentBucketName,
      tmpBucketName: this.tmpBucketName,
    })
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as TransactionViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)

    return new TransactionService(
      tenantId,
      { mongoDb: client, dynamoDb },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
  }

  public async getTransactionsCount(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    return await this.transactionRepository.getTransactionsCount(params)
  }

  @auditLog('TRANSACTION', 'TRANSACTION_LIST', 'DOWNLOAD')
  public async getTransactionsListV2(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<AuditLogReturnData<TransactionsResponseOffsetPaginated>> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const clickhouseTransactionsRepository =
      new ClickhouseTransactionsRepository(
        clickhouseClient,
        this.dynamoDb,
        this.tenantId
      )

    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }

    const data = await clickhouseTransactionsRepository.getTransactions(params)

    if (params.includeUsers) {
      data.items = await this.getTransactionUsers(data.items)
    }
    return {
      result: data,
      entities:
        params.view === 'DOWNLOAD'
          ? [{ entityId: 'TRANSACTION_DOWNLOAD', entityAction: 'DOWNLOAD' }]
          : [],
      publishAuditLog: () => params.view === 'DOWNLOAD',
    }
  }

  /**
   * Gets only transaction table data without count calculation for improved performance
   */
  public async getTransactionsTableDataOnly(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionTableItem[]> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const clickhouseTransactionsRepository =
      new ClickhouseTransactionsRepository(
        clickhouseClient,
        this.dynamoDb,
        this.tenantId
      )

    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }

    const items =
      await clickhouseTransactionsRepository.getTransactionsDataOnly(params)

    if (params.includeUsers) {
      return await this.getTransactionUsers(items)
    }

    return items
  }

  /**
   * Gets only the count of transactions without fetching actual data
   */
  public async getTransactionsCountOnly(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<number> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const clickhouseTransactionsRepository =
      new ClickhouseTransactionsRepository(
        clickhouseClient,
        this.dynamoDb,
        this.tenantId
      )

    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }

    return await clickhouseTransactionsRepository.getTransactionsCountOnly(
      params
    )
  }

  /**
   * Gets only transaction table data without count calculation for MongoDB (non-ClickHouse)
   */
  public async getTransactionsTableDataOnlyMongo(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionTableItem[]> {
    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }

    const items = await this.transactionRepository.getTransactionsDataOnly(
      params,
      this.getProjection(params.view as TableListViewEnum),
      undefined
    )

    let mappedTransactions = items.map((transaction) =>
      this.mongoTransactionMapper(transaction)
    )

    if (params.includeUsers) {
      mappedTransactions = await this.getTransactionUsers(mappedTransactions)
    }

    return mappedTransactions
  }

  /**
   * Gets only the count of transactions for MongoDB (non-ClickHouse)
   */
  public async getTransactionsCountOnlyMongo(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<number> {
    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }

    return await this.transactionRepository.getTransactionsCountOnly(
      params,
      undefined
    )
  }

  public async getCasesTransactions(
    params: DefaultApiGetCaseTransactionsRequest
  ) {
    const { caseId, ...rest } = params
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const case_ = await caseRepository.getCaseById(caseId)

    if (!case_) {
      throw new NotFound(`Case ${caseId} not found`)
    }

    const caseTransactionsIds = case_.caseTransactionsIds ?? []

    const data = await this.getTransactionsList(
      { ...rest, filterIdList: caseTransactionsIds },
      { includeUsers: true },
      undefined,
      'cursor'
    )

    return data as CursorPaginationResponse<TransactionTableItem>
  }

  private mongoTransactionMapper(
    transaction: InternalTransaction
  ): TransactionTableItem {
    return {
      transactionId: transaction.transactionId,
      timestamp: transaction.timestamp,
      arsScore: {
        arsScore: transaction.arsScore?.arsScore,
      },
      destinationPayment: {
        amount: transaction.destinationAmountDetails?.transactionAmount,
        currency: transaction.destinationAmountDetails?.transactionCurrency,
        country: transaction.destinationAmountDetails?.country,
        paymentMethodId: transaction?.destinationPaymentMethodId,
        paymentDetails: transaction?.destinationPaymentDetails,
      },
      originPayment: {
        amount: transaction.originAmountDetails?.transactionAmount,
        currency: transaction.originAmountDetails?.transactionCurrency,
        country: transaction.originAmountDetails?.country,
        paymentMethodId: transaction?.originPaymentMethodId,
        paymentDetails: transaction?.originPaymentDetails,
      },
      hasHitRules: !!(transaction?.hitRules ?? []).length,
      destinationUser: { id: transaction?.destinationUserId },
      originUser: { id: transaction?.originUserId },
      productType: transaction?.productType,
      reference: transaction?.reference,
      status: transaction?.status,
      tags: transaction?.tags,
      transactionState: transaction?.transactionState,
      type: transaction.type,
      hitRules: transaction.hitRules?.map((rule) => ({
        ruleName: rule.ruleName,
        ruleDescription: rule.ruleDescription,
      })),
      originFundsInfo: transaction.originFundsInfo,
      alertIds: transaction.alertIds,
    }
  }

  public async getAlertsTransaction(
    params: DefaultApiGetAlertTransactionListRequest
  ): Promise<CursorPaginationResponse<TransactionTableItem>> {
    if (!params.filterPaymentDetailName && params.filterSanctionsHitId) {
      const sanctionsHitsRepository = new SanctionsHitsRepository(
        this.tenantId,
        { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
      )
      const hit = await sanctionsHitsRepository.searchHits({
        filterHitIds: [params.filterSanctionsHitId],
      })
      params.filterPaymentDetailName = hit?.items?.[0]?.hitContext?.searchTerm
    }

    return (await this.getTransactionsList(
      { ...params },
      { includeUsers: true },
      params.filterPaymentMethodId ? params.filterPaymentMethodId : undefined,
      'cursor'
    )) as CursorPaginationResponse<TransactionTableItem>
  }

  public async getTransactionsList(
    params: DefaultApiGetTransactionsListRequest,
    options: { includeUsers?: boolean } = {},
    filterPaymentMethodId?: string,
    type: 'offset' | 'cursor' = 'offset'
  ): Promise<
    | TransactionsResponseOffsetPaginated
    | CursorPaginationResponse<TransactionTableItem>
  > {
    const { includeUsers } = options

    let alert: Alert | null = null
    if (params.alertId) {
      const alertRepository = new AlertsRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      })

      alert = await alertRepository.getAlertById(params.alertId)

      if (
        alert &&
        filterPaymentMethodId &&
        alert.ruleHitMeta?.hitDirections?.length
      ) {
        const hasOriginDirection =
          alert.ruleHitMeta?.hitDirections?.includes('ORIGIN')
        if (alert.ruleId === 'R-169') {
          if (hasOriginDirection) {
            params.filterDestinationPaymentMethodId = filterPaymentMethodId
          } else {
            params.filterOriginPaymentMethodId = filterPaymentMethodId
          }
        } else {
          if (hasOriginDirection) {
            params.filterOriginPaymentMethodId = filterPaymentMethodId
          } else {
            params.filterDestinationPaymentMethodId = filterPaymentMethodId
          }
        }
      }
    }
    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }
    let response =
      type === 'offset'
        ? await this.getTransactionsOffsetPaginated(params, alert)
        : await this.getTransactionsCursorPaginated(params, alert)

    if (alert && params.alertId) {
      response = {
        ...response,
        items: response.items.map((transaction) => {
          const ruleInstanceId = alert?.ruleInstanceId
          const matchingRule = ruleInstanceId
            ? transaction.executedRules?.find(
                (rule) => rule.ruleInstanceId === ruleInstanceId
              )
            : undefined
          return matchingRule?.ruleHit
            ? { ...transaction, status: matchingRule.ruleAction }
            : transaction
        }),
      }
    }

    let mappedTransactions = response.items.map((transaction) =>
      this.mongoTransactionMapper(transaction)
    )

    if (includeUsers) {
      mappedTransactions = await this.getTransactionUsers(mappedTransactions)
    }

    return { ...response, items: mappedTransactions }
  }

  private async getTransactionUsers(
    transactions: TransactionTableItem[]
  ): Promise<TransactionTableItem[]> {
    const userIds = compact(
      Array.from(
        new Set<string | undefined>(
          transactions.flatMap((t) => [t.originUser?.id, t.destinationUser?.id])
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

    return transactions.map((t) => {
      if (t.originUser) {
        t.originUser.name = getUserName(userMap.get(t.originUser.id))
        t.originUser.type = userMap.get(t.originUser.id)?.type
      }
      if (t.destinationUser) {
        t.destinationUser.name = getUserName(userMap.get(t.destinationUser.id))
        t.destinationUser.type = userMap.get(t.destinationUser.id)?.type
      }
      return t
    })
  }

  private getProjection(view: TableListViewEnum) {
    return {
      projection: {
        _id: 1,
        type: 1,
        transactionId: 1,
        timestamp: 1,
        originUserId: 1,
        destinationUserId: 1,
        transactionState: 1,
        originAmountDetails: 1,
        destinationAmountDetails: 1,
        originPaymentDetails: 1,
        destinationPaymentDetails: 1,
        productType: 1,
        tags: 1,
        status: 1,
        originPaymentMethodId: 1,
        destinationPaymentMethodId: 1,
        arsScore: {
          arsScore: 1,
        },
        originFundsInfo: 1,
        executedRules:
          view === ('TABLE' as TableListViewEnum)
            ? {
                ruleInstanceId: 1,
                ruleHitMeta: { sanctionsDetails: { searchId: 1 } },
              }
            : [],
        hitRules:
          view === ('TABLE' as TableListViewEnum)
            ? { ruleName: 1, ruleDescription: 1 }
            : [],
        alertIds: 1,
        reference: 1,
      },
    }
  }

  public async getTransactionsOffsetPaginated(
    params: DefaultApiGetTransactionsListRequest,
    alert?: Alert | null
  ) {
    const result =
      await this.transactionRepository.getTransactionsOffsetPaginated(
        params,
        this.getProjection(params.view as TableListViewEnum),
        alert
      )
    return result
  }

  public async getTransactionsCursorPaginated(
    params: DefaultApiGetTransactionsListRequest,
    alert?: Alert | null
  ) {
    const result =
      await this.transactionRepository.getTransactionsCursorPaginated(
        params,
        this.getProjection(params.view as TableListViewEnum),
        alert
      )
    return result
  }

  public getTransactionCursor(params: DefaultApiGetTransactionsListRequest) {
    return this.transactionRepository.getTransactionsCursor(params)
  }

  public async getStatsByType(
    params: DefaultApiGetTransactionsStatsByTypeRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTypesResponse['data']> {
    if (isClickhouseEnabled()) {
      const clickhouseClient = await getClickhouseClient(this.tenantId)
      const clickhouseTransactionsRepository =
        new ClickhouseTransactionsRepository(
          clickhouseClient,
          this.dynamoDb,
          this.tenantId
        )

      const data = await clickhouseTransactionsRepository.getStatsByType(params)
      const currencyService = new CurrencyService(this.dynamoDb)
      const exchangeRateWithUsd = await currencyService.getCurrencyExchangeRate(
        referenceCurrency,
        'USD'
      )

      return data.map((item) => ({
        ...item,
        sum: (item?.sum ?? 0) * exchangeRateWithUsd,
        min: (item?.min ?? 0) * exchangeRateWithUsd,
        max: (item?.max ?? 0) * exchangeRateWithUsd,
        median: (item?.median ?? 0) * exchangeRateWithUsd,
        average: (item?.average ?? 0) * exchangeRateWithUsd,
        count: item?.count ?? 0,
        transactionType:
          item.transactionType === '' ? undefined : item.transactionType,
      }))
    }

    return await this.transactionRepository.getStatsByType(
      params,
      referenceCurrency
    )
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsStatsByTimeRequest,
    referenceCurrency: Currency,
    aggregateBy: 'status' | 'transactionState'
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    if (isClickhouseEnabled()) {
      const clickhouseClient = await getClickhouseClient(this.tenantId)
      const clickhouseTransactionsRepository =
        new ClickhouseTransactionsRepository(
          clickhouseClient,
          this.dynamoDb,
          this.tenantId
        )

      return await clickhouseTransactionsRepository.getStatsByTime(
        params,
        referenceCurrency
      )
    }

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

  public async importFlatFile(request: TransactionFlatFileUploadRequest) {
    const { file } = request

    const files = await this.s3Service.copyFilesToPermanentBucket([file])
    await sendBatchJobCommand({
      tenantId: this.tenantId,
      type: 'FLAT_FILES_VALIDATION',
      parameters: {
        entityId: 'TRANSACTIONS',
        format: 'CSV',
        s3Key: files[0].s3Key,
        schema: 'TRANSACTIONS_UPLOAD',
      },
    })
  }
}

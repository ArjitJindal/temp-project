import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import { compact } from 'lodash'
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
  DefaultApiGetTransactionsV2ListRequest,
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
import { TransactionsResponse } from '@/@types/openapi-internal/TransactionsResponse'
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
import { Alert } from '@/@types/openapi-internal/Alert'

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

  public async getTransactionsListV2(
    params: DefaultApiGetTransactionsV2ListRequest
  ): Promise<TransactionsResponseOffsetPaginated> {
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const clickhouseTransactionsRepository =
      new ClickhouseTransactionsRepository(clickhouseClient, this.dynamoDb)

    const data = await clickhouseTransactionsRepository.getTransactions(params)

    if (params.includeUsers) {
      data.items = await this.getTransactionUsers(data.items)
    }

    return data
  }

  public async getCasesTransactions(
    params: DefaultApiGetCaseTransactionsRequest
  ): Promise<CursorPaginationResponse<TransactionTableItem>> {
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
      { includeUsers: true }
    )

    return data
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
      isAnySanctionsExecutedRules: !!(transaction?.executedRules ?? [])
        ?.map((rule) =>
          rule?.ruleHitMeta?.sanctionsDetails?.map((r) => r?.sanctionHitIds)
        )
        .flat().length,
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
  ) {
    if (!params.filterPaymentDetailName && params.filterSanctionsHitId) {
      const sanctionsHitsRepository = new SanctionsHitsRepository(
        this.tenantId,
        this.mongoDb
      )
      const hit = await sanctionsHitsRepository.searchHits({
        filterHitIds: [params.filterSanctionsHitId],
      })
      params.filterPaymentDetailName = hit?.items?.[0]?.hitContext?.searchTerm
    }

    return this.getTransactionsList(
      {
        ...params,
      },
      {
        includeUsers: true,
      },
      params.filterPaymentMethodId ? params.filterPaymentMethodId : undefined
    )
  }

  public async getTransactionsList(
    params: DefaultApiGetTransactionsListRequest,
    options: { includeUsers?: boolean } = {},
    filterPaymentMethodId?: string
  ): Promise<TransactionsResponse> {
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

        if (hasOriginDirection) {
          params.filterDestinationPaymentMethodId = filterPaymentMethodId
        } else {
          params.filterOriginPaymentMethodId = filterPaymentMethodId
        }
      }
    }
    let response = await this.getTransactions(params, alert)
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
    transaction: TransactionTableItem[]
  ): Promise<TransactionTableItem[]> {
    const userIds = compact(
      Array.from(
        new Set<string | undefined>(
          transaction.flatMap((t) => [t.originUser?.id, t.destinationUser?.id])
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

    return transaction
  }

  public async getTransactions(
    params: DefaultApiGetTransactionsListRequest,
    alert?: Alert | null
  ) {
    const result =
      await this.transactionRepository.getTransactionsCursorPaginate(
        params,
        {
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
              params.view === ('TABLE' as TableListViewEnum)
                ? {
                    ruleInstanceId: 1,
                    ruleHitMeta: {
                      sanctionsDetails: {
                        searchId: 1,
                      },
                    },
                  }
                : [],
            hitRules:
              params.view === ('TABLE' as TableListViewEnum)
                ? {
                    ruleName: 1,
                    ruleDescription: 1,
                  }
                : [],
            alertIds: 1,
          },
        },
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
        new ClickhouseTransactionsRepository(clickhouseClient, this.dynamoDb)

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
        new ClickhouseTransactionsRepository(clickhouseClient, this.dynamoDb)

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
}

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { InternalServerError, BadRequest, NotFound } from 'http-errors'
import { TransactionService } from './services/transaction-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { addNewSubsegment } from '@/core/xray'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CsvHeaderSettings, ExportService } from '@/services/export'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'

export type TransactionViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
  MAXIMUM_ALLOWED_EXPORT_SIZE: string
}

export const TRANSACTION_EXPORT_HEADERS_SETTINGS: CsvHeaderSettings<InternalTransaction> =
  {
    type: 'INCLUDE',
    transactionId: 'INCLUDE',
    timestamp: 'INCLUDE',
    transactionState: 'INCLUDE',
    originUserId: 'INCLUDE',
    originPaymentMethodId: 'SKIP',
    destinationPaymentMethodId: 'SKIP',
    destinationUserId: 'INCLUDE',
    originAmountDetails: {
      transactionAmount: 'INCLUDE',
      transactionCurrency: 'INCLUDE',
      country: 'INCLUDE',
    },
    destinationAmountDetails: {
      transactionAmount: 'INCLUDE',
      transactionCurrency: 'INCLUDE',
      country: 'INCLUDE',
    },
    originPaymentDetails: 'JSON',
    destinationPaymentDetails: 'JSON',
    productType: 'INCLUDE',
    promotionCodeUsed: 'INCLUDE',
    reference: 'INCLUDE',
    deviceData: {
      batteryLevel: 'INCLUDE',
      deviceLatitude: 'INCLUDE',
      deviceLongitude: 'INCLUDE',
      ipAddress: 'INCLUDE',
      deviceIdentifier: 'INCLUDE',
      vpnUsed: 'INCLUDE',
      operatingSystem: 'INCLUDE',
      deviceMaker: 'INCLUDE',
      deviceModel: 'INCLUDE',
      deviceYear: 'INCLUDE',
      appVersion: 'INCLUDE',
    },
    relatedTransactionIds: 'JSON',
    tags: 'JSON',
    executedRules: 'JSON',
    hitRules: 'JSON',
    status: 'INCLUDE',
    originUser: 'SKIP',
    destinationUser: 'SKIP',
    events: 'SKIP',
    arsScore: 'SKIP',
  }

export const transactionsViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET, MAXIMUM_ALLOWED_EXPORT_SIZE } =
      process.env as TransactionViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      client
    )
    const userRepository = new UserRepository(tenantId, { mongoDb: client })
    const transactionEventsRepository = new TransactionEventRepository(
      tenantId,
      { mongoDb: client }
    )
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
      mongoDb: client,
    })

    const transactionService = new TransactionService(
      transactionRepository,
      riskRepository,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    if (event.httpMethod === 'GET' && event.path.endsWith('/transactions')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField,
        sortOrder,
        includeUsers,
        includeEvents,
        filterStatus,
        filterCaseStatus,
        filterOriginPaymentMethod,
        filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
        from,
        order,
      } = event.queryStringParameters as any
      const transactionsGetSegment = await addNewSubsegment(
        'Transaction Service',
        'Get Transactions'
      )
      transactionsGetSegment?.addAnnotation('tenantId', tenantId)
      transactionsGetSegment?.addAnnotation(
        'params',
        JSON.stringify(event.queryStringParameters)
      )
      const params: DefaultApiGetTransactionsListRequest = {
        pageSize: parseInt(pageSize) || 50,
        _from: from,
        order,
        page,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState: filterTransactionState
          ? filterTransactionState.split(',')
          : undefined,
        filterStatus: filterStatus ? filterStatus.split(',') : undefined,
        filterCaseStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField: sortField,
        sortOrder: sortOrder,
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        includeUsers: includeUsers === 'true',
        includeEvents: includeEvents === 'true',
        filterOriginPaymentMethod: filterOriginPaymentMethod,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
      }
      transactionsGetSegment?.close()
      const response = await transactionService.getTransactions(params)
      if (includeUsers) {
        const userIds = Array.from(
          new Set<string>(
            response.items.flatMap(
              (t) =>
                [t.originUserId, t.destinationUserId].filter(
                  Boolean
                ) as string[]
            )
          )
        )
        const users = await userRepository.getMongoUsersByIds(userIds)
        const userMap = new Map()
        users.forEach((u) => userMap.set(u.userId, u))
        response.items.map((t) => {
          t.originUser = userMap.get(t.originUserId)
          t.destinationUser = userMap.get(t.destinationUserId)
          return t
        })
      }
      if (includeEvents) {
        const events =
          await transactionEventsRepository.getMongoTransactionEvents(
            response.items.map((t) => t.transactionId)
          )
        response.items.map((t) => {
          t.events = events.get(t.transactionId)
          return t
        })
      }
      return response
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/transactions/stats/by-types')
    ) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField,
        sortOrder,
        includeUsers,
        includeEvents,
        filterStatus,
        filterCaseStatus,
        filterOriginPaymentMethod,
        filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
        referenceCurrency,
      } = event.queryStringParameters as any

      const params: DefaultApiGetTransactionsListRequest = {
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState: filterTransactionState
          ? filterTransactionState.split(',')
          : undefined,
        filterStatus: filterStatus ? filterStatus.split(',') : undefined,
        filterCaseStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField: sortField,
        sortOrder: sortOrder,
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        includeUsers: includeUsers === 'true',
        includeEvents: includeEvents === 'true',
        filterOriginPaymentMethod: filterOriginPaymentMethod,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
      }
      const transactionsStatsGetSegment = await addNewSubsegment(
        'Transaction Service',
        'Get Transactions Stats By Type'
      )
      transactionsStatsGetSegment?.addAnnotation('tenantId', tenantId)
      transactionsStatsGetSegment?.addAnnotation(
        'params',
        JSON.stringify(params)
      )
      const result = await transactionService.getStatsByType(
        params,
        referenceCurrency ?? 'USD'
      )
      transactionsStatsGetSegment?.close()
      return {
        data: result,
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/transactions/stats/by-time')
    ) {
      const {
        pageSize,
        page,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField,
        sortOrder,
        includeUsers,
        includeEvents,
        filterStatus,
        filterCaseStatus,
        filterOriginPaymentMethod,
        filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
        referenceCurrency,
      } = event.queryStringParameters as any

      const params: DefaultApiGetTransactionsListRequest = {
        pageSize,
        page,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState: filterTransactionState
          ? filterTransactionState.split(',')
          : undefined,
        filterStatus: filterStatus ? filterStatus.split(',') : undefined,
        filterCaseStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField: sortField,
        sortOrder: sortOrder,
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        includeUsers: includeUsers === 'true',
        includeEvents: includeEvents === 'true',
        filterOriginPaymentMethod: filterOriginPaymentMethod,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod,
        filterTagKey,
        filterTagValue,
      }
      const transactionsStatsGetSegment = await addNewSubsegment(
        'Transaction Service',
        'Get Transactions Stats By Time'
      )
      transactionsStatsGetSegment?.addAnnotation('tenantId', tenantId)
      transactionsStatsGetSegment?.addAnnotation(
        'params',
        JSON.stringify(params)
      )
      const result = await transactionService.getStatsByTime(
        params,
        referenceCurrency ?? 'USD'
      )
      transactionsStatsGetSegment?.close()
      return {
        data: result,
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/transactions/export')
    ) {
      const exportService = new ExportService<InternalTransaction>(
        'case',
        s3,
        TMP_BUCKET
      )
      const {
        pageSize,
        page,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterTagKey,
        filterTagValue,
        sortField,
        sortOrder,
      } = event.queryStringParameters as any
      const params: DefaultApiGetTransactionsListRequest = {
        pageSize: pageSize,
        page: page,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        filterTagKey,
        filterTagValue,
        sortField: sortField,
        sortOrder: sortOrder,
      }

      const transactionsCount =
        await transactionRepository.getTransactionsCount(params)
      const maximumExportSize = parseInt(MAXIMUM_ALLOWED_EXPORT_SIZE)
      if (Number.isNaN(maximumExportSize)) {
        throw new InternalServerError(
          `Wrong environment configuration, cannot get MAXIMUM_ALLOWED_EXPORT_SIZE`
        )
      }
      if (transactionsCount > maximumExportSize) {
        // todo: i18n
        throw new BadRequest(
          `File size is too large, it should not have more than ${maximumExportSize} rows! Please add more filters to make it smaller`
        )
      }
      let transactionsCursor =
        await transactionRepository.getTransactionsCursor(params)

      transactionsCursor = transactionsCursor.map((transaction) => {
        return {
          ...transaction,
          executedRules: transaction.executedRules.filter(
            ({ ruleHit }) => ruleHit
          ),
        }
      })

      return await exportService.export(
        transactionsCursor,
        TRANSACTION_EXPORT_HEADERS_SETTINGS
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/transactions/uniques')
    ) {
      const { field, filter } = event.queryStringParameters as any
      const transactionsStatsGetSegment = await addNewSubsegment(
        'Transaction Service',
        'Transaction Uniques'
      )
      transactionsStatsGetSegment?.addAnnotation('tenantId', tenantId)
      const result = await transactionService.getUniques({
        field,
        direction: 'origin',
        filter,
      })
      transactionsStatsGetSegment?.close()
      return result.filter((item) => item != null)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/transactions/{transactionId}' &&
      event.pathParameters?.transactionId
    ) {
      const transaction = await transactionService.getTransaction(
        event.pathParameters.transactionId
      )
      if (transaction == null) {
        throw new NotFound(`Unable to find transaction`)
      }
      return transaction
    }

    throw new Error('Unhandled request')
  }
)

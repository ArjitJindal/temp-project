import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, InternalServerError, NotFound } from 'http-errors'
import compact from 'lodash/compact'
import { TransactionService } from './services/transaction-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CsvHeaderSettings, ExportService } from '@/services/export'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { RulesEngineService } from '@/services/rules-engine'
import { CaseService } from '@/services/cases'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import { TransactionViewConfig } from '@/@types/tranasction/transaction-config'

const DEVICE_DATA_FIELDS: CsvHeaderSettings<
  InternalTransaction['originDeviceData']
> = {
  batteryLevel: 'INCLUDE',
  deviceLatitude: 'INCLUDE',
  deviceLongitude: 'INCLUDE',
  ipAddress: 'INCLUDE',
  ipCountry: 'INCLUDE',
  deviceIdentifier: 'INCLUDE',
  vpnUsed: 'INCLUDE',
  operatingSystem: 'INCLUDE',
  deviceMaker: 'INCLUDE',
  deviceModel: 'INCLUDE',
  deviceYear: 'INCLUDE',
  appVersion: 'INCLUDE',
}

const TRANSACTION_EXPORT_HEADERS_SETTINGS: CsvHeaderSettings<InternalTransaction> =
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
    originDeviceData: DEVICE_DATA_FIELDS,
    destinationDeviceData: DEVICE_DATA_FIELDS,
    relatedTransactionIds: 'JSON',
    originFundsInfo: 'JSON',
    tags: 'JSON',
    executedRules: 'JSON',
    hitRules: 'JSON',
    status: 'INCLUDE',
    originUser: 'SKIP',
    destinationUser: 'SKIP',
    events: 'SKIP',
    arsScore: 'SKIP',
    createdAt: 'SKIP',
    updatedAt: 'SKIP',
    riskScoreDetails: 'JSON',
    alertIds: 'SKIP',
    updateCount: 'SKIP',
  }

export const transactionsViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { TMP_BUCKET, MAXIMUM_ALLOWED_EXPORT_SIZE } =
      process.env as TransactionViewConfig
    const s3 = getS3ClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const [rulesEngineService, caseService, transactionService] =
      await Promise.all([
        RulesEngineService.fromEvent(event),
        CaseService.fromEvent(event),
        TransactionService.fromEvent(event),
      ])

    const handlers = new Handlers()

    handlers.registerGetTransactionsList(async (context, request) => {
      if (isClickhouseEnabled()) {
        if (request.view === 'DOWNLOAD') {
          const result = await transactionService.getTransactionsListV2(request)
          return result.result
        }
        if (request.responseType === 'data') {
          const items = await transactionService.getTransactionsTableDataOnly(
            request
          )
          return { items, count: 0 }
        }

        if (request.responseType === 'count') {
          const count = await transactionService.getTransactionsCountOnly(
            request
          )
          return { items: [], count }
        }

        const result = await transactionService.getTransactionsListV2(request)
        return result.result
      }

      if (request.view === 'DOWNLOAD') {
        const result = await transactionService.getTransactionsList(request, {
          includeUsers: request.includeUsers,
        })
        return result
      }

      if (request.responseType === 'data') {
        const items =
          await transactionService.getTransactionsTableDataOnlyMongo(request)
        return { items, count: 0 }
      }

      if (request.responseType === 'count') {
        const count = await transactionService.getTransactionsCountOnlyMongo(
          request
        )
        return { items: [], count }
      }

      const result = await transactionService.getTransactionsList(request, {
        includeUsers: request.includeUsers,
      })
      return result
    })

    handlers.registerGetTransactionsStatsByType(async (context, request) => ({
      data: await transactionService.getStatsByType(
        request,
        (request.referenceCurrency || 'USD') as CurrencyCode
      ),
    }))

    handlers.registerGetTransactionsStatsByTime(async (context, request) => ({
      data: await transactionService.getStatsByTime(
        request,
        (request.referenceCurrency || 'USD') as CurrencyCode,
        request.aggregateBy ?? 'status'
      ),
    }))

    handlers.registerGetTransactionsListExport(async (context, request) => {
      const exportService = new ExportService<InternalTransaction>(
        'case',
        s3,
        TMP_BUCKET
      )
      const transactionsCount = await transactionService.getTransactionsCount(
        request
      )
      const maxAllowedExportSize = parseInt(MAXIMUM_ALLOWED_EXPORT_SIZE)
      if (Number.isNaN(maxAllowedExportSize)) {
        throw new InternalServerError(
          `Wrong environment configuration, cannot get MAXIMUM_ALLOWED_EXPORT_SIZE`
        )
      }
      if (transactionsCount > maxAllowedExportSize) {
        throw new BadRequest(
          `File size is too large, it should not have more than ${maxAllowedExportSize} rows! Please add more filters to make it smaller`
        )
      }

      const transactionsCursor = transactionService
        .getTransactionCursor(request)
        .map((transaction) => {
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
    })

    handlers.registerGetTransactionsUniques(async (context, request) => {
      const { field, filter } = request

      const [originResult, destinationResult] = await Promise.all([
        transactionService.getUniques({ field, direction: 'origin', filter }),
        transactionService.getUniques({
          field,
          direction: 'destination',
          filter,
        }),
      ])

      const result = [...new Set([...originResult, ...destinationResult])]

      return compact(result)
    })

    handlers.registerGetTransaction(async (context, request) => {
      const transaction = await transactionService.getTransaction(
        request.transactionId
      )
      if (transaction == null) {
        throw new NotFound(`Unable to find transaction`)
      }
      return transaction
    })

    handlers.registerApplyTransactionsAction(async (ctx, req) => {
      const response = await rulesEngineService.applyTransactionAction(
        req.TransactionAction,
        ctx.userId
      )
      await caseService.applyTransactionAction(req.TransactionAction)
      return response
    })

    handlers.registerGetTransactionEvents(async (ctx, req) => {
      const transactionEventsRepository = new TransactionEventRepository(
        tenantId,
        { dynamoDb, mongoDb }
      )

      return await transactionEventsRepository.getTransactionEventsPaginatedMongo(
        req.transactionId,
        { page: req.page || 1, pageSize: req.pageSize || DEFAULT_PAGE_SIZE }
      )
    })

    handlers.registerPostTransactionFlatFileUpload(async (ctx, request) => {
      return await transactionService.importFlatFile(
        request.TransactionFlatFileUploadRequest
      )
    })

    return await handlers.handle(event)
  }
)

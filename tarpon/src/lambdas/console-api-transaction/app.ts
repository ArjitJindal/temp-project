import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { InternalServerError, BadRequest, NotFound } from 'http-errors'
import { compact } from 'lodash'
import { ClickhouseTransactionsRepository } from '../../services/rules-engine/repositories/clickhouse-repository'
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
import { AlertsService } from '@/services/alerts'
import { CaseService } from '@/services/cases'
import { getClickhouseClient } from '@/utils/clickhouse-utils'

export type TransactionViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
  MAXIMUM_ALLOWED_EXPORT_SIZE: string
}

const DEVICE_DATA_FIELDS: CsvHeaderSettings<
  InternalTransaction['originDeviceData']
> = {
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
    originDeviceData: DEVICE_DATA_FIELDS,
    destinationDeviceData: DEVICE_DATA_FIELDS,
    relatedTransactionIds: 'JSON',
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
    const mongoDb = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClient()
    const rulesEngineService = await RulesEngineService.fromEvent(event)
    const alertService = await AlertsService.fromEvent(event)
    const caseService = await CaseService.fromEvent(event)
    const transactionService = new TransactionService(
      tenantId,
      { mongoDb, dynamoDb },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    const handlers = new Handlers()

    handlers.registerGetTransactionsList(async (context, request) => {
      return await transactionService.getTransactionsList(request, {
        includeEvents: request.includeEvents,
        includeUsers: request.includeUsers,
      })
    })

    handlers.registerGetTransactionsV2List(async (context, request) => {
      const clickHouseClient = await getClickhouseClient()
      const clickHouseTransactionsRepository =
        new ClickhouseTransactionsRepository(tenantId, clickHouseClient)

      return await clickHouseTransactionsRepository.getTransactions(request)
    })

    handlers.registerGetTransactionsStatsByType(async (context, request) => ({
      data: await transactionService.getStatsByType(
        request,
        request.referenceCurrency || 'USD'
      ),
    }))

    handlers.registerGetTransactionsStatsByTime(async (context, request) => ({
      data: await transactionService.getStatsByTime(
        request,
        request.referenceCurrency || 'USD',
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
        transactionService.getUniques({
          field,
          direction: 'origin',
          filter,
        }),
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
      const cases = await caseService.getCases({
        filterTransactionIds: req.TransactionAction.transactionIds,
      })
      if (!cases) {
        throw new NotFound('Case(s) not found for transactions')
      }
      await Promise.all(
        cases.data.flatMap((c) => {
          if (!c.alerts) {
            return []
          }
          return c.alerts.flatMap((alert) => {
            const txnIds = req.TransactionAction.transactionIds.filter((tid) =>
              alert.transactionIds?.includes(tid)
            )

            if (txnIds.length > 0 && alert.alertId) {
              const promises: Promise<any>[] = []

              if (alert.ruleAction === 'SUSPEND') {
                const commentBody: string =
                  txnIds.join(', ') +
                  ` set to ` +
                  req.TransactionAction.action +
                  `. Reasons: ` +
                  req.TransactionAction.reason.join(', ') +
                  `. Comment: ` +
                  req.TransactionAction.comment
                promises.push(
                  alertService.saveComment(alert.alertId, {
                    body: commentBody,
                    files: req.TransactionAction.files,
                  })
                )
              }

              if (req.TransactionAction.action === 'ALLOW') {
                promises.push(
                  alertService.closeAlertIfAllTransactionsApproved(
                    alert,
                    txnIds
                  )
                )
              }

              return promises
            }
            return []
          })
        })
      )
      return response
    })
    return await handlers.handle(event)
  }
)

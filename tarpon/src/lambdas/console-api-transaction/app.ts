import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { InternalServerError, BadRequest, NotFound } from 'http-errors'
import { compact } from 'lodash'
import { TransactionService } from './services/transaction-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CsvHeaderSettings, ExportService } from '@/services/export'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { RulesEngineService } from '@/services/rules-engine'
import { AlertsService } from '@/services/alerts'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { background } from '@/utils/background'

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
    createdAt: 'SKIP',
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
    const rulesEngineService = await RulesEngineService.fromEvent(event)
    const alertService = await AlertsService.fromEvent(event)
    const caseService = await CaseService.fromEvent(event)
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

    const handlers = new Handlers()

    handlers.registerGetTransactionsList(async (context, request) => {
      const { includeUsers, includeEvents } = request
      const response = await transactionService.getTransactions(request)
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
        request.referenceCurrency || 'USD'
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
      let transactionsCursor =
        await transactionRepository.getTransactionsCursor(request)

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
        cases.data.map(async (c) => {
          if (!c.alerts) {
            return
          }
          await Promise.all(
            c.alerts?.map((alert) => {
              const txnIds: string[] = []
              req.TransactionAction.transactionIds.forEach((tid) => {
                if (alert.transactionIds?.includes(tid)) {
                  txnIds.push(tid)
                }
              })
              if (
                txnIds.length > 0 &&
                alert.alertId &&
                alert.ruleAction === 'SUSPEND'
              ) {
                return background(
                  alertService.saveAlertComment(alert.alertId, {
                    body: `${txnIds.join(', ')} set to ${
                      req.TransactionAction.action
                    }. Reasons: ${req.TransactionAction.reason.join(
                      ', '
                    )}. Comment: ${req.TransactionAction.comment}`,
                  })
                )
              }
            })
          )
        })
      )
      return response
    })
    return await handlers.handle(event)
  }
)

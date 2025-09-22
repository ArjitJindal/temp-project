import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { v4 as uuid4, v4 as uuidv4 } from 'uuid'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { publicLambdaApi } from '@/core/middlewares/public-lambda-api-middleware'
import { RulesEngineService } from '@/services/rules-engine'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { pickKnownEntityFields } from '@/utils/object'
import { TransactionUpdatable } from '@/@types/openapi-public/TransactionUpdatable'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import {
  filterLiveRules,
  sendAsyncRuleTasks,
} from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import { MAX_BATCH_IMPORT_COUNT } from '@/utils/transaction'

type TransactionUserMap = Record<
  string,
  { originUserId?: string; destinationUserId?: string }
>

export const transactionEventHandler = publicLambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()

    const createTransactionEvent = async (
      transactionEvent: TransactionEvent
    ) => {
      transactionEvent.updatedTransactionAttributes =
        transactionEvent.updatedTransactionAttributes &&
        pickKnownEntityFields(
          transactionEvent.updatedTransactionAttributes,
          TransactionUpdatable
        )
      updateLogMetadata({
        transactionId: transactionEvent.transactionId,
        eventId: transactionEvent.eventId,
      })
      logger.info(`Processing Transaction Event`) // Need to log to show on the logs
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      const rulesEngine = new RulesEngineService(
        tenantId,
        dynamoDb,
        logicEvaluator,
        mongoDb
      )
      const result = await rulesEngine.verifyTransactionEvent(transactionEvent)

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }

    handlers.registerPostTransactionEvent(
      async (_ctx, { TransactionEvent: transactionEvent }) =>
        await createTransactionEvent(transactionEvent)
    )
    handlers.registerPostBatchTransactionEvents(async (ctx, request) => {
      if (
        request.TransactionEventBatchRequest.data.length >
        MAX_BATCH_IMPORT_COUNT
      ) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }
      const batchId = request.TransactionEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      const { response, validatedTransactionEvents, validatedTransactions } =
        await batchImportService.importTransactionEvents(
          batchId,
          request.TransactionEventBatchRequest.data
        )

      const transactionUserIdMap: TransactionUserMap =
        validatedTransactions.reduce((acc, v) => {
          acc[v.transactionId] = {
            originUserId: v.originUserId,
            destinationUserId: v.destinationUserId,
          }
          return acc
        }, {} as TransactionUserMap)

      await sendAsyncRuleTasks(
        validatedTransactionEvents.map((v) => ({
          type: 'TRANSACTION_EVENT_BATCH',
          transactionEvent: { ...v, eventId: v.eventId ?? uuidv4() },
          tenantId,
          originUserId: transactionUserIdMap[v.transactionId]?.originUserId,
          destinationUserId:
            transactionUserIdMap[v.transactionId]?.destinationUserId,
          batchId,
        }))
      )
      return response
    })
    handlers.registerGetTransactionEvent(async (_ctx, { eventId }) => {
      const transactionEventRepository = new TransactionEventRepository(
        tenantId,
        { mongoDb }
      )
      const result = await transactionEventRepository.getMongoTransactionEvent(
        eventId
      )
      if (!result) {
        throw new NotFound(`Transaction event ${eventId} not found`)
      }
      return result
    })

    handlers.registerGetBatchTransactionEvents(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb: dynamoDb,
        mongoDb,
      })
      const result = await batchImportService.getBatchTransactionEvents(
        batchId,
        { page, pageSize }
      )
      return result
    })

    return await handlers.handle(event)
  }
)

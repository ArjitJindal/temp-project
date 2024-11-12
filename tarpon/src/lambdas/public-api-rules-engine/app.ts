import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Credentials } from '@aws-sdk/client-sts'
import { v4 as uuid4 } from 'uuid'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RulesEngineService } from '@/services/rules-engine'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { DefaultApiPostConsumerTransactionRequest } from '@/@types/openapi-public/RequestParameters'
import { updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { addNewSubsegment } from '@/core/xray'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { pickKnownEntityFields } from '@/utils/object'
import { UserOptional } from '@/@types/openapi-public/UserOptional'
import { BusinessOptional } from '@/@types/openapi-public/BusinessOptional'
import { TransactionUpdatable } from '@/@types/openapi-public/TransactionUpdatable'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { filterLiveRules } from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import { RiskScoringV8Service } from '@/services/risk-scoring/risk-scoring-v8-service'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'

async function getMissingRelatedTransactions(
  relatedTransactionIds: string[],
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
) {
  const transactionRepository = new DynamoDbTransactionRepository(
    tenantId,
    dynamoDb
  )
  const relatedTransactions = await transactionRepository.getTransactionsByIds(
    relatedTransactionIds
  )
  const foundTransactions: string[] = []

  if (relatedTransactions.length === relatedTransactionIds.length) {
    return []
  } else {
    relatedTransactionIds.map((transactionId) => {
      relatedTransactions.map((transaction) => {
        if (transaction.transactionId === transactionId) {
          foundTransactions.push(transactionId)
        }
      })
    })
    return relatedTransactionIds.filter((x) => !foundTransactions.includes(x))
  }
}

export const transactionHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()

    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)

    const verifyTransaction = async (
      request: DefaultApiPostConsumerTransactionRequest
    ) => {
      const transaction = request.Transaction
      const validationSegment = await addNewSubsegment('API', 'Validation')
      validationSegment?.addAnnotation('tenantId', tenantId)
      validationSegment?.addAnnotation(
        'transactionId',
        transaction.transactionId
      )
      updateLogMetadata({ transactionId: transaction.transactionId })
      logger.info(`Processing transaction`) // Need to log to show on the logs

      if (
        transaction.relatedTransactionIds &&
        transaction.relatedTransactionIds.length
      ) {
        const missingRelatedTransactions = await getMissingRelatedTransactions(
          transaction.relatedTransactionIds,
          tenantId,
          dynamoDb
        )
        if (missingRelatedTransactions.length) {
          throw new BadRequest(
            `Transaction with ID(s): ${missingRelatedTransactions} do not exist.`
          )
        }
      }

      validationSegment?.close()
      logger.info(`Verifying transaction`)

      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      if (request._trsOnly === 'true') {
        const riskScoringV8Service = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb: await getMongoDbClient(),
            dynamoDb,
          }
        )
        const result = await riskScoringV8Service.handleTransaction(
          transaction,
          [
            {
              transactionId: transaction.transactionId,
              timestamp: transaction.timestamp,
              transactionState: transaction.transactionState ?? 'CREATED',
              updatedTransactionAttributes: transaction,
            },
          ],
          // NOTE: no user entity variables being used in the transaction risk factors for PNB
          undefined,
          undefined
        )
        return {
          transactionId: transaction.transactionId,
          status: 'ALLOW',
          executedRules: [],
          hitRules: [],
          riskScoreDetails: result,
        }
      }

      const rulesEngine = new RulesEngineService(
        tenantId,
        dynamoDb,
        logicEvaluator
      )
      const result = await rulesEngine.verifyTransaction(transaction, {
        validateOriginUserId:
          !request?.validateOriginUserId ||
          request?.validateOriginUserId === 'true',
        validateDestinationUserId:
          !request?.validateDestinationUserId ||
          request?.validateDestinationUserId === 'true',
        validateTransactionId:
          !request?.validateTransactionId ||
          request?.validateTransactionId === 'true',
      })
      logger.info(`Completed processing transaction`)
      return {
        ...result,
        ...filterLiveRules(result),
      }
    }
    handlers.registerGetConsumerTransaction(async (_ctx, request) => {
      const transactionRepository = new DynamoDbTransactionRepository(
        tenantId,
        dynamoDb
      )
      const result = await transactionRepository.getTransactionById(
        request.transactionId
      )
      if (!result) {
        throw new NotFound(`Transaction ${request.transactionId} not found`)
      }
      return {
        ...result,
        ...filterLiveRules(result),
      }
    })
    handlers.registerPostConsumerTransaction(async (_ctx, request) => {
      return verifyTransaction(request)
    })
    handlers.registerPostBatchTransactions(async (ctx, request) => {
      const batchId = request.TransactionBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importTransactions(
        batchId,
        request.TransactionBatchRequest.data,
        {
          validateOriginUserId:
            !request.validateOriginUserId ||
            request.validateOriginUserId === 'true',
          validateDestinationUserId:
            !request.validateDestinationUserId ||
            request.validateDestinationUserId === 'true',
        }
      )
      try {
        // TODO do this in a queue
        await Promise.all(
          request.TransactionBatchRequest.data.map((transaction) =>
            verifyTransaction({
              Transaction: transaction,
              validateOriginUserId: request.validateOriginUserId,
              validateDestinationUserId: request.validateDestinationUserId,
            })
          )
        )
      } catch (error) {
        logger.error(`Error verifying transactions: ${error}`)
      }
      return response
    })
    return await handlers.handle(event)
  }
)

export const transactionEventHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)

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
        logicEvaluator
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
      const batchId = request.TransactionEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importTransactionEvents(
        batchId,
        request.TransactionEventBatchRequest.data
      )
      try {
        // TODO do this in a queue
        await Promise.all(
          request.TransactionEventBatchRequest.data.map((event) =>
            createTransactionEvent(event)
          )
        )
      } catch (error) {
        logger.error(`Error verifying transactions: ${error}`)
      }
      return response
    })
    handlers.registerGetTransactionEvent(async (_ctx, { eventId }) => {
      const transactionEventRepository = new TransactionEventRepository(
        tenantId,
        { mongoDb: await getMongoDbClient() }
      )
      const result = await transactionEventRepository.getMongoTransactionEvent(
        eventId
      )
      if (!result) {
        throw new NotFound(`Transaction event ${eventId} not found`)
      }
      return result
    })
    return await handlers.handle(event)
  }
)

export const userEventsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)

    const createUserEvent = async (
      userEvent: ConsumerUserEvent,
      allowUserTypeConversion?: string,
      lockCraRiskLevel?: string
    ) => {
      userEvent.updatedConsumerUserAttributes =
        userEvent.updatedConsumerUserAttributes &&
        pickKnownEntityFields(
          userEvent.updatedConsumerUserAttributes,
          UserOptional
        )
      updateLogMetadata({
        userId: userEvent.userId,
        eventId: userEvent.eventId,
      })
      logger.info(`Processing Consumer User Event`) // Need to log to show on the logs
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        await getMongoDbClient(),
        logicEvaluator
      )

      const { updatedConsumerUserAttributes } = userEvent
      if (updatedConsumerUserAttributes?.linkedEntities) {
        await userManagementService.validateLinkedEntitiesAndEmitEvent(
          updatedConsumerUserAttributes?.linkedEntities,
          userEvent.userId
        )
      }
      const isDrsUpdatable = lockCraRiskLevel
        ? lockCraRiskLevel !== 'true'
        : undefined
      const result: UserWithRulesResult =
        await userManagementService.verifyConsumerUserEvent(
          userEvent,
          allowUserTypeConversion === 'true',
          isDrsUpdatable
        )

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }

    handlers.registerPostUserEvent(
      async (
        _ctx,
        {
          ConsumerUserEvent: userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel,
        }
      ) => {
        return createUserEvent(
          userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel
        )
      }
    )
    handlers.registerPostBatchConsumerUserEvents(async (ctx, request) => {
      const batchId = request.ConsumerUserEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importConsumerUserEvents(
        batchId,
        request.ConsumerUserEventBatchRequest.data
      )
      try {
        // TODO do this in a queue
        await Promise.all(
          request.ConsumerUserEventBatchRequest.data.map((userEvent) => {
            return createUserEvent(userEvent)
          })
        )
      } catch (error) {
        logger.error(`Error verifying users: ${error}`)
      }
      return response
    })
    handlers.registerPostBatchBusinessUserEvents(async (ctx, request) => {
      const batchId = request.BusinessUserEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importBusinessUserEvents(
        batchId,
        request.BusinessUserEventBatchRequest.data
      )
      return response
    })
    handlers.registerPostBusinessUserEvent(
      async (
        _ctx,
        {
          BusinessUserEvent: userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel,
        }
      ) => {
        userEvent.updatedBusinessUserAttributes =
          userEvent.updatedBusinessUserAttributes &&
          pickKnownEntityFields(
            userEvent.updatedBusinessUserAttributes,
            BusinessOptional
          )
        updateLogMetadata({
          businessUserId: userEvent.userId,
          eventId: userEvent.eventId,
        })
        logger.info(`Processing Business User Event`) // Need to log to show on the logs
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        const userManagementService = new UserManagementService(
          tenantId,
          dynamoDb,
          await getMongoDbClient(),
          logicEvaluator
        )
        const { updatedBusinessUserAttributes } = userEvent
        if (updatedBusinessUserAttributes?.linkedEntities) {
          await userManagementService.validateLinkedEntitiesAndEmitEvent(
            updatedBusinessUserAttributes?.linkedEntities,
            userEvent.userId
          )
        }

        const isDrsUpdatable = lockCraRiskLevel
          ? lockCraRiskLevel !== 'true'
          : undefined
        const result = await userManagementService.verifyBusinessUserEvent(
          userEvent,
          allowUserTypeConversion === 'true',
          isDrsUpdatable
        )

        return {
          ...result,
          ...filterLiveRules(result),
        }
      }
    )

    const getUserEventHandler = async (_ctx, { eventId }) => {
      const userEventRepository = new UserEventRepository(tenantId, {
        mongoDb: await getMongoDbClient(),
      })
      const result = await userEventRepository.getMongoUserEvent(eventId)
      if (!result) {
        throw new NotFound(`User event ${eventId} not found`)
      }
      return result
    }

    handlers.registerGetConsumerUserEvent(getUserEventHandler)
    handlers.registerGetBusinessUserEvent(getUserEventHandler)
    return await handlers.handle(event)
  }
)

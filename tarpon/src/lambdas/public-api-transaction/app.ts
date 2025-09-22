import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { v4 as uuid4 } from 'uuid'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { publicLambdaApi } from '@/core/middlewares/public-lambda-api-middleware'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RulesEngineService } from '@/services/rules-engine'
import { DefaultApiPostConsumerTransactionRequest } from '@/@types/openapi-public/RequestParameters'
import { updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { addNewSubsegment } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  filterLiveRules,
  sendAsyncRuleTasks,
} from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import { RiskScoringV8Service } from '@/services/risk-scoring/risk-scoring-v8-service'
import { MAX_BATCH_IMPORT_COUNT } from '@/utils/transaction'

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

export const transactionHandler = publicLambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()

    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()

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
            mongoDb,
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
        logicEvaluator,
        mongoDb
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
      if (
        request.TransactionBatchRequest.data.length > MAX_BATCH_IMPORT_COUNT
      ) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }
      const batchId = request.TransactionBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      const { response, validatedTransactions } =
        await batchImportService.importTransactions(
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
      await sendAsyncRuleTasks(
        validatedTransactions.map((v) => ({
          type: 'TRANSACTION_BATCH',
          transaction: v,
          tenantId,
          batchId,
        }))
      )
      return response
    })
    handlers.registerGetBatchTransactions(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      return await batchImportService.getBatchTransactions(batchId, {
        page,
        pageSize,
      })
    })
    return await handlers.handle(event)
  }
)

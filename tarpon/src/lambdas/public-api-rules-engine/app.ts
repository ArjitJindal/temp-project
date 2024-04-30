import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Credentials } from '@aws-sdk/client-sts'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  getNewTransactionID,
  DynamoDbTransactionRepository,
} from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RulesEngineService } from '@/services/rules-engine'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import {
  DefaultApiPostBusinessUserEventRequest,
  DefaultApiPostConsumerTransactionRequest,
} from '@/@types/openapi-public/RequestParameters'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { UserRepository } from '@/services/users/repositories/user-repository'
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

type MissingUserIdMap = { field: string; userId: string }

async function getTransactionMissingUsers(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  validationParams?: Omit<
    DefaultApiPostConsumerTransactionRequest,
    'Transaction'
  >
): Promise<(MissingUserIdMap | undefined)[]> {
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  let userIds: string[] = Array.from(
    new Set([transaction.originUserId, transaction.destinationUserId])
  ).filter((id) => id) as string[]

  if (validationParams) {
    if (
      validationParams?.validateOriginUserId === 'false' &&
      validationParams?.validateDestinationUserId === 'false'
    ) {
      return []
    }
    if (validationParams?.validateOriginUserId === 'false') {
      userIds = Array.from(new Set([transaction.destinationUserId])).filter(
        (id) => id
      ) as string[]
    } else if (validationParams?.validateDestinationUserId === 'false') {
      userIds = Array.from(new Set([transaction.originUserId])).filter(
        (id) => id
      ) as string[]
    }
  }

  if (userIds.length === 0) return []
  const users = await userRepository.getUsers(userIds)
  const existingUserIds = users.map((user) => user.userId)
  if (users.length === userIds.length) {
    return []
  } else {
    return userIds
      .filter((userId) => !existingUserIds.includes(userId))
      .map((userId) => {
        if (userId === transaction.originUserId) {
          return {
            field: 'originUserId',
            userId: userId,
          }
        } else if (userId === transaction.destinationUserId) {
          return {
            field: 'destinationUserId',
            userId: userId,
          }
        }
      })
  }
}

function getMissingUsersMessage(
  userIds: (MissingUserIdMap | undefined)[]
): string {
  switch (userIds.length) {
    case 2:
      return `${userIds[0]?.field}: ${userIds[0]?.userId} and ${userIds[1]?.field}: ${userIds[1]?.userId} do not exist`
    default:
      return `${userIds[0]?.field}: ${userIds[0]?.userId} does not exist`
  }
}

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
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const pathTransactionId = event.pathParameters?.transactionId

    if (event.httpMethod === 'POST' && event.body) {
      const validationSegment = await addNewSubsegment('API', 'Validation')
      const validationParams = event.queryStringParameters
      const transaction = pickKnownEntityFields(
        JSON.parse(event.body) as Transaction,
        Transaction
      )
      const transactionId = getNewTransactionID(transaction)

      validationSegment?.addAnnotation('tenantId', tenantId)
      validationSegment?.addAnnotation('transactionId', transactionId)
      updateLogMetadata({ transactionId })
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

      const missingUsers = await getTransactionMissingUsers(
        transaction,
        tenantId,
        dynamoDb,
        validationParams || undefined
      )
      if (missingUsers.length > 0) {
        throw new BadRequest(getMissingUsersMessage(missingUsers))
      }

      logger.info(`Verifying transaction`)
      validationSegment?.close()
      const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
      const result = await rulesEngine.verifyTransaction(transaction)
      logger.info(`Completed processing transaction`)
      return {
        ...result,
        ...filterLiveRules(result),
      }
    } else if (event.httpMethod === 'GET' && pathTransactionId) {
      const transactionRepository = new DynamoDbTransactionRepository(
        tenantId,
        dynamoDb
      )
      const result = await transactionRepository.getTransactionById(
        pathTransactionId
      )
      if (!result) {
        throw new NotFound(`Transaction ${pathTransactionId} not found`)
      }
      return {
        ...result,
        ...filterLiveRules(result),
      }
    }
    throw new Error('Unhandled request')
  }
)

export const transactionEventHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const eventId = event.pathParameters?.eventId
    const dynamoDb = getDynamoDbClientByEvent(event)
    const transactionEventRepository = new TransactionEventRepository(
      tenantId,
      { mongoDb: await getMongoDbClient() }
    )

    if (event.httpMethod === 'POST' && event.body) {
      const transactionEvent = pickKnownEntityFields(
        JSON.parse(event.body) as TransactionEvent,
        TransactionEvent
      )
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

      const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
      const result = await rulesEngine.verifyTransactionEvent(transactionEvent)

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }
    if (event.httpMethod === 'GET' && eventId) {
      const result = await transactionEventRepository.getMongoTransactionEvent(
        eventId
      )
      if (!result) {
        throw new NotFound(`Transaction event ${eventId} not found`)
      }
      return result
    }
    throw new Error('Unhandled request')
  }
)

export const userEventsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const eventId = event.pathParameters?.eventId
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userEventRepository = new UserEventRepository(tenantId, {
      mongoDb: await getMongoDbClient(),
    })
    const { allowUserTypeConversion } =
      (event.queryStringParameters as Omit<
        DefaultApiPostBusinessUserEventRequest,
        'BusinessUserEvent'
      >) ?? {}

    if (
      event.httpMethod === 'POST' &&
      event.resource === '/events/consumer/user' &&
      event.body
    ) {
      const userEvent = pickKnownEntityFields(
        JSON.parse(event.body) as ConsumerUserEvent,
        ConsumerUserEvent
      )
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

      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        await getMongoDbClient()
      )

      const result = await userManagementService.verifyConsumerUserEvent(
        userEvent,
        allowUserTypeConversion === 'true'
      )

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/events/business/user' &&
      event.body
    ) {
      const userEvent = pickKnownEntityFields(
        JSON.parse(event.body) as BusinessUserEvent,
        BusinessUserEvent
      )
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

      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        await getMongoDbClient()
      )
      const { updatedBusinessUserAttributes } = userEvent
      if (updatedBusinessUserAttributes?.linkedEntities) {
        await userManagementService.validateLinkedEntitiesAndEmitEvent(
          updatedBusinessUserAttributes?.linkedEntities,
          userEvent.userId
        )
      }
      const result = await userManagementService.verifyBusinessUserEvent(
        userEvent,
        allowUserTypeConversion === 'true'
      )

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }
    if (event.httpMethod === 'GET' && eventId) {
      const result = await userEventRepository.getMongoUserEvent(eventId)
      if (!result) {
        throw new NotFound(`User event ${eventId} not found`)
      }
      return result
    }
    throw new Error('Unhandled request')
  }
)

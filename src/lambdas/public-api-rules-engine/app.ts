import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { BadRequest } from 'http-errors'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import {
  verifyBusinessUserEvent,
  verifyTransaction,
  verifyTransactionEvent,
  verifyConsumerUserEvent,
} from '@/services/rules-engine'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { UserRepository } from '@/services/users/repositories/user-repository'

type MissingUserIdMap = { field: string; userId: string }

async function getTransactionMissingUsers(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: DocumentClient
): Promise<(MissingUserIdMap | undefined)[]> {
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const userIds: string[] = Array.from(
    new Set([transaction.originUserId, transaction.destinationUserId])
  ).filter((id) => id) as string[]
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

export const transactionHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const transactionId = event.pathParameters?.transactionId

    if (event.httpMethod === 'POST' && event.body) {
      const transaction = JSON.parse(event.body)
      const missingUsers = await getTransactionMissingUsers(
        transaction,
        tenantId,
        dynamoDb
      )
      if (missingUsers.length === 0) {
        const result = await verifyTransaction(transaction, tenantId, dynamoDb)
        return result
      } else {
        throw new BadRequest(getMissingUsersMessage(missingUsers))
      }
    } else if (event.httpMethod === 'GET' && transactionId) {
      const transactionRepository = new TransactionRepository(tenantId, {
        dynamoDb,
      })
      const result = await transactionRepository.getTransactionById(
        transactionId
      )
      return result
    }
    throw new Error('Unhandled request')
  }
)

export const transactionEventHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)

    if (event.httpMethod === 'POST' && event.body) {
      const transactionEvent = JSON.parse(event.body) as TransactionEvent
      let missingUsers: (MissingUserIdMap | undefined)[] = []
      if (transactionEvent.updatedTransactionAttributes) {
        missingUsers = await getTransactionMissingUsers(
          transactionEvent.updatedTransactionAttributes,
          tenantId,
          dynamoDb
        )
      }
      const isValidPayload =
        !transactionEvent.updatedTransactionAttributes ||
        missingUsers.length === 0
      if (isValidPayload) {
        return await verifyTransactionEvent(
          transactionEvent,
          tenantId,
          dynamoDb
        )
      } else {
        throw new BadRequest(getMissingUsersMessage(missingUsers))
      }
    }
    throw new Error('Unhandled request')
  }
)

export const userEventsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)

    if (
      event.httpMethod === 'POST' &&
      event.resource === '/events/consumer/user' &&
      event.body
    ) {
      const userEvent = JSON.parse(event.body) as ConsumerUserEvent
      return await verifyConsumerUserEvent(userEvent, tenantId, dynamoDb)
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/events/business/user' &&
      event.body
    ) {
      const userEvent = JSON.parse(event.body) as BusinessUserEvent
      return await verifyBusinessUserEvent(userEvent, tenantId, dynamoDb)
    }
    throw new Error('Unhandled request')
  }
)

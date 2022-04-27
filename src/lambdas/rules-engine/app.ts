import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { verifyTransaction, verifyUserEvent } from '@/services/rules-engine'
import { UserEvent } from '@/@types/openapi-public/UserEvent'

export const transactionHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const transactionId = event.pathParameters?.transactionId

    if (event.httpMethod === 'POST' && event.body) {
      const transaction = JSON.parse(event.body)
      const result = await verifyTransaction(transaction, tenantId, dynamoDb)
      return result
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

export const userEventHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)

    if (event.httpMethod === 'POST' && event.body) {
      const userEvent = JSON.parse(event.body) as UserEvent
      return await verifyUserEvent(userEvent, tenantId, dynamoDb)
    }
    throw new Error('Unhandled request')
  }
)

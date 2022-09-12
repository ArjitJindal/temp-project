import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
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
      return await verifyTransactionEvent(transactionEvent, tenantId, dynamoDb)
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

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RuleInstanceQueryStringParameters } from '../rules-engine/app'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { RuleRepository } from '../rules-engine/repositories/rule-repository'
import { lambdaApi } from '../../core/middlewares/lambda-api-middlewares'
import { BusinessUsersListResponse } from '../../@types/openapi-internal/BusinessUsersListResponse'
import { ConsumerUsersListResponse } from '../../@types/openapi-internal/ConsumerUsersListResponse'
import { DefaultApiGetTransactionsListRequest } from '../../@types/openapi-internal/RequestParameters'
import {
  UserRepository,
  UserType,
} from '../user-management/repositories/user-repository'

import { JWTAuthorizerResult } from '../jwt-authorizer/app'
import { getS3Client } from '../../utils/s3'
import { Comment } from '../../@types/openapi-internal/Comment'
import { connectToDB } from '../../utils/docDBUtils'
import { TransactionService } from './services/transaction-service'
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'

export type TransactionViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const transactionsViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as TransactionViewConfig
    const s3 = getS3Client(event)
    const transactionService = new TransactionService(
      tenantId,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    if (event.httpMethod === 'GET' && event.path === '/transactions') {
      const { limit, skip, beforeTimestamp } =
        event.queryStringParameters as any
      const params: DefaultApiGetTransactionsListRequest = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        beforeTimestamp: parseInt(beforeTimestamp),
      }
      return transactionService.getTransactions(params)
    } else if (
      event.httpMethod === 'POST' &&
      event.pathParameters?.transactionId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      return transactionService.saveTransactionComment(
        event.pathParameters.transactionId,
        { ...comment, userId }
      )
    } else if (
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.transactionId &&
      event.pathParameters?.commentId
    ) {
      return transactionService.deleteTransactionComment(
        event.pathParameters.transactionId,
        event.pathParameters.commentId
      )
    }

    throw new Error('Unhandled request')
  }
)

export const transactionsPerUserViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const client = await connectToDB()
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb: client,
    })
    const { limit, skip, beforeTimestamp } = event.queryStringParameters as any
    const params: DefaultApiGetTransactionsListRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      beforeTimestamp: parseInt(beforeTimestamp),
    }

    return transactionRepository.getTransactionsPerUser(params, userId)
  }
)

export const dashboardStatsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    console.log('To be implemented')
  }
)

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<BusinessUsersListResponse> => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { limit, skip, beforeTimestamp } = event.queryStringParameters as any
    const params: DefaultApiGetTransactionsListRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      beforeTimestamp: parseInt(beforeTimestamp),
    }
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    return userRepository.getUsers(params, 'BUSINESS' as UserType)
  }
)

export const consumerUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<ConsumerUsersListResponse> => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { limit, skip, beforeTimestamp } = event.queryStringParameters as any
    const params: DefaultApiGetTransactionsListRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      beforeTimestamp: parseInt(beforeTimestamp),
    }
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    return userRepository.getUsers(params, 'CONSUMER' as UserType)
  }
)

export const ruleInstanceHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { tenantId } =
      event.queryStringParameters as RuleInstanceQueryStringParameters
    const dynamoDb = getDynamoDbClient(event)
    const ruleRepository = new RuleRepository(tenantId, dynamoDb)
    const ruleInstanceId = event.pathParameters?.id

    if (event.httpMethod === 'PUT' && ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      await ruleRepository.createOrUpdateRuleInstance({
        id: ruleInstanceId,
        ...JSON.parse(event.body),
      })
      return 'OK'
    } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
      await ruleRepository.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (event.httpMethod === 'POST' && !ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      const newRuleInstance = await ruleRepository.createOrUpdateRuleInstance(
        JSON.parse(event.body)
      )
      return newRuleInstance
    }

    throw new Error('Unhandled request')
  }
)

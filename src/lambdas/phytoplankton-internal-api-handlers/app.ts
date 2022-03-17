import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RuleInstanceQueryStringParameters } from '../rules-engine/app'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'
import { RuleRepository } from '../rules-engine/repositories/rule-repository'
import { connectToDB } from '../../utils/docDBUtils'
import { lambdaApi } from '../../core/middlewares/lambda-api-middlewares'
import { TransactionsListResponse } from '../../@types/openapi-internal/TransactionsListResponse'
import { BusinessUsersListResponse } from '../../@types/openapi-internal/BusinessUsersListResponse'
import { ConsumerUsersListResponse } from '../../@types/openapi-internal/ConsumerUsersListResponse'
import { DefaultApiGetTransactionsListRequest } from '../../@types/openapi-internal/RequestParameters'
import {
  UserRepository,
  UserType,
} from '../user-management/repositories/user-repository'

export const transactionsViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<TransactionsListResponse> => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { limit, skip, beforeTimestamp } = event.queryStringParameters as any
    const params: DefaultApiGetTransactionsListRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      beforeTimestamp: parseInt(beforeTimestamp),
    }
    const client = await connectToDB()
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb: client,
    })
    return transactionRepository.getTransactions(params)
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

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { ManagementClient } from 'auth0'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
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
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'
import { RuleRepository } from '../rules-engine/repositories/rule-repository'
import { Rule } from '../../@types/openapi-internal/Rule'
import { TransactionService } from './services/transaction-service'
import { RuleService } from './services/rule-service'

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
    const client = await connectToDB()
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb: client,
    })
    const transactionService = new TransactionService(
      transactionRepository,
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
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await connectToDB()
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb: client,
    })
    const { limit, skip, beforeTimestamp, userId } =
      event.queryStringParameters as any
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
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    console.log('To be implemented')
  }
)

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
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

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

    if (event.httpMethod === 'GET' && event.path === '/rules') {
      const rules = await ruleService.getAllRules()
      return rules
    } else if (
      event.httpMethod === 'POST' &&
      event.path === '/rules' &&
      event.body
    ) {
      const rule = JSON.parse(event.body) as Rule
      return ruleService.createOrUpdateRule(rule)
    } else if (
      event.httpMethod === 'PUT' &&
      event.pathParameters?.ruleId &&
      event.body
    ) {
      const rule = JSON.parse(event.body) as Rule
      return ruleService.createOrUpdateRule({
        ...rule,
        id: event.pathParameters.ruleId,
      })
    } else if (event.httpMethod === 'DELETE' && event.pathParameters?.ruleId) {
      return await ruleService.deleteRule(event.pathParameters.ruleId)
    }

    throw new Error('Unhandled request')
  }
)

export const ruleInstanceHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)
    const ruleInstanceId = event.pathParameters?.ruleInstanceId

    if (event.httpMethod === 'PUT' && ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        id: ruleInstanceId,
        ...JSON.parse(event.body),
      })
      return 'OK'
    } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
      await ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.path === '/rule_instances' &&
      event.body
    ) {
      const newRuleInstance =
        await ruleInstanceRepository.createOrUpdateRuleInstance(
          JSON.parse(event.body)
        )
      return newRuleInstance
    } else if (event.httpMethod === 'GET' && event.path === '/rule_instances') {
      return ruleService.getAllRuleInstances()
    }
    throw new Error('Unhandled request')
  }
)

export type AccountsConfig = {
  AUTH0_DOMAIN: string
  AUTH0_MANAGEMENT_CLIENT_ID: string
  AUTH0_MANAGEMENT_CLIENT_SECRET: string
}

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const config = process.env as AccountsConfig
    const auth0 = new ManagementClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
    })
    if (event.httpMethod === 'GET') {
      // TODO: Switch to Auth0 organizations to have clear tenants separation
      return auth0.getUsers({ q: `app_metadata.tenantId:"${tenantId}"` })
    }

    throw new Error('Unhandled request')
  }
)

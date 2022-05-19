import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { ManagementClient } from 'auth0'
import { NotFound } from 'http-errors'
import { TransactionService } from './services/transaction-service'
import { RuleService } from './services/rule-service'
import { DashboardStatsRepository } from './repository/dashboard-stats-repository'
import { timeframeToTimestampConverter } from './utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'

import { getS3Client } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import { connectToDB } from '@/utils/mongoDBUtils'
import { Rule } from '@/@types/openapi-internal/Rule'

import { TransactionUpdateRequest } from '@/@types/openapi-internal/TransactionUpdateRequest'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'

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
    if (event.httpMethod === 'GET' && event.path.endsWith('/transactions')) {
      const {
        limit,
        skip,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterRulesHit,
        filterRulesExecuted,
      } = event.queryStringParameters as any
      const params: DefaultApiGetTransactionsListRequest = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
      }
      return transactionService.getTransactions(params)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/transactions/{transactionId}' &&
      event.pathParameters?.transactionId &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as TransactionUpdateRequest
      return transactionService.updateTransaction(
        userId,
        event.pathParameters.transactionId,
        updateRequest
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/transactions/{transactionId}' &&
      event.pathParameters?.transactionId
    ) {
      const transaction = await transactionService.getTransaction(
        event.pathParameters.transactionId
      )
      if (transaction == null) {
        throw new NotFound(`Unable to find transaction`)
      }
      return transaction
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/transactions/{transactionId}/comments' &&
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
    const {
      limit,
      skip,
      afterTimestamp,
      beforeTimestamp,
      userId,
      filterId,
      filterOutStatus,
    } = event.queryStringParameters as any
    const params: DefaultApiGetTransactionsListRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      afterTimestamp: parseInt(afterTimestamp) || undefined,
      beforeTimestamp: parseInt(beforeTimestamp),
      filterId,
      filterOutStatus,
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
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await connectToDB()
    const { timeframe } = event.queryStringParameters as any
    const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
      mongoDb: client,
    })
    const transactionStatsData =
      await dashboardStatsRepository.getTransactionCountStats(
        timeframe,
        timeframeToTimestampConverter(timeframe)
      )
    return {
      transactionStatsData,
    }
  }
)

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    if (event.httpMethod === 'GET' && event.path.endsWith('/business/users')) {
      const { limit, skip, afterTimestamp, beforeTimestamp, filterId } =
        event.queryStringParameters as any
      return userRepository.getBusinessUsers({
        limit: parseInt(limit),
        skip: parseInt(skip),
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
      })
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/business/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userRepository.getMongoBusinessUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user
    }
  }
)

export const consumerUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    if (event.httpMethod === 'GET' && event.path.endsWith('/consumer/users')) {
      const { limit, skip, afterTimestamp, beforeTimestamp, filterId } =
        event.queryStringParameters as any
      return userRepository.getConsumerUsers({
        limit: parseInt(limit),
        skip: parseInt(skip),
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
      })
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/consumer/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userRepository.getMongoConsumerUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user
    }
  }
)

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClient(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

    if (event.httpMethod === 'GET' && event.path.endsWith('/rules')) {
      const rules = await ruleService.getAllRules()
      return rules
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/rule_implementations')
    ) {
      return ruleService.getAllRuleImplementations()
    } else if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/rules') &&
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
      await ruleService.deleteRule(event.pathParameters.ruleId)
      return 'OK'
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
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
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
      await ruleService.createOrUpdateRuleInstance({
        id: ruleInstanceId,
        ...JSON.parse(event.body),
      })
      return 'OK'
    } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
      await ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/rule_instances') &&
      event.body
    ) {
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance(
        JSON.parse(event.body)
      )
      return newRuleInstance
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/rule_instances')
    ) {
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

// todo: move to config
const CONNECTION_NAME = 'Username-Password-Authentication'

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const {
      principalId: tenantId,
      tenantName,
      role,
    } = event.requestContext.authorizer
    const config = process.env as AccountsConfig
    const managementClient = new ManagementClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
    })
    if (event.httpMethod === 'GET') {
      // TODO: Switch to Auth0 organizations to have clear tenants separation
      return managementClient.getUsers({
        q: `app_metadata.tenantId:"${tenantId}"`,
      })
    }
    if (event.httpMethod === 'POST') {
      assertRole(role, 'admin')
      if (event.body == null) {
        throw new Error(`Body should not be empty`)
      }
      // todo: validate
      const { email, password } = JSON.parse(event.body)
      return await managementClient.createUser({
        connection: CONNECTION_NAME,
        email,
        password,
        app_metadata: {
          tenantName: tenantName,
          tenantId: tenantId,
          role: 'user',
        },
      })
    } else if (event.httpMethod === 'DELETE') {
      const { pathParameters } = event
      const userId = pathParameters?.userId
        ? decodeURIComponent(pathParameters?.userId)
        : null
      if (!userId) {
        throw new Error(`userId is not provided`)
      }
      assertRole(role, 'admin')
      // todo: do proper input sanitize to prevent injections
      const users = await managementClient.getUsers({
        q: `app_metadata.tenantId:${tenantId} AND user_id:${userId}`,
      })
      if (users.length === 0) {
        throw new Error(
          `Unable to find user "${userId}" in the tenant |${tenantId}|`
        )
      }
      const [user] = users
      await managementClient.deleteUser({ id: user.user_id! })
      return true
    }

    throw new Error('Unhandled request')
  }
)

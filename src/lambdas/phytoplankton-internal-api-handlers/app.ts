import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, InternalServerError, NotFound } from 'http-errors'
import { HammerheadStackConstants } from '@cdk/constants'
import { TransactionService } from './services/transaction-service'
import { RuleService } from './services/rule-service'
import { DashboardStatsRepository } from './repository/dashboard-stats-repository'
import { UserService } from './services/user-service'
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
import { ExportService } from '@/lambdas/phytoplankton-internal-api-handlers/services/export-service'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import {
  DashboardTimeFrameType,
  TRANSACTION_EXPORT_HEADERS_SETTINGS,
} from '@/lambdas/phytoplankton-internal-api-handlers/constants'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { Tenant as ApiTenant } from '@/@types/openapi-internal/Tenant'
import { ChangeTenantPayload } from '@/@types/openapi-internal/ChangeTenantPayload'
import { Account } from '@/@types/openapi-internal/Account'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { RiskRepository } from '@/services/rules-engine/repositories/risk-repository'

export type TransactionViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
  MAXIMUM_ALLOWED_EXPORT_SIZE: string
}

export const transactionsViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET, MAXIMUM_ALLOWED_EXPORT_SIZE } =
      process.env as TransactionViewConfig
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
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField,
        sortOrder,
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
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField: sortField,
        sortOrder: sortOrder,
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
      }
      return transactionService.getTransactions(params)
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/transactions/export')
    ) {
      const exportService = new ExportService<TransactionCaseManagement>(
        'case',
        s3,
        TMP_BUCKET
      )
      const {
        limit,
        skip,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        sortField,
        sortOrder,
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
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        sortField: sortField,
        sortOrder: sortOrder,
      }

      const transactionsCount =
        await transactionRepository.getTransactionsCount(params)
      const maximumExportSize = parseInt(MAXIMUM_ALLOWED_EXPORT_SIZE)
      if (Number.isNaN(maximumExportSize)) {
        throw new InternalServerError(
          `Wrong environment configuration, cannot get MAXIMUM_ALLOWED_EXPORT_SIZE`
        )
      }
      if (transactionsCount > maximumExportSize) {
        // todo: i18n
        throw new BadRequest(
          `File size is too large, it should not have more than ${maximumExportSize} rows! Please add more filters to make it smaller`
        )
      }
      let transactionsCursor =
        await transactionRepository.getTransactionsCursor(params)

      transactionsCursor = transactionsCursor.map((transaction) => {
        return {
          ...transaction,
          executedRules: transaction.executedRules.filter(
            ({ ruleHit }) => ruleHit
          ),
        }
      })

      return await exportService.export(
        transactionsCursor,
        TRANSACTION_EXPORT_HEADERS_SETTINGS
      )
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

export const dashboardStatsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/transactions')
    ) {
      const client = await connectToDB()
      const { principalId: tenantId } = event.requestContext.authorizer
      const { timeframe, endTimestamp } = event.queryStringParameters as {
        timeframe?: DashboardTimeFrameType
        endTimestamp?: string
      }
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      // await dashboardStatsRepository.refreshStats(tenantId)

      if (timeframe == null) {
        throw new BadRequest(`Missing required parameter: ${timeframe}`)
      }
      const endTimestampNumber = endTimestamp
        ? parseInt(endTimestamp)
        : Number.NaN
      if (Number.isNaN(endTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }

      const data = await dashboardStatsRepository.getTransactionCountStats(
        timeframe,
        endTimestampNumber
      )
      return {
        data,
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/hits_per_user')
    ) {
      const client = await connectToDB()
      const { principalId: tenantId } = event.requestContext.authorizer
      const { startTimestamp, endTimestamp } = event.queryStringParameters as {
        startTimestamp?: string
        endTimestamp?: string
      }
      const endTimestampNumber = endTimestamp
        ? parseInt(endTimestamp)
        : Number.NaN
      if (Number.isNaN(endTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      const startTimestampNumber = startTimestamp
        ? parseInt(startTimestamp)
        : Number.NaN
      if (Number.isNaN(startTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }

      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      // await dashboardStatsRepository.refreshStats(tenantId)

      return {
        data: await dashboardStatsRepository.getHitsByUserStats(
          tenantId,
          startTimestampNumber,
          endTimestampNumber
        ),
      }
    }
    throw new BadRequest('Unsupported path')
  }
)

export type UserViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3Client(event)
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    const userService = new UserService(
      userRepository,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    if (event.httpMethod === 'GET' && event.path.endsWith('/business/users')) {
      const { limit, skip, afterTimestamp, beforeTimestamp, filterId } =
        event.queryStringParameters as any
      return userService.getBusinessUsers({
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
      const user = await userService.getBusinessUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/business/users/{userId}/files' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const fileInfo = JSON.parse(event.body) as FileInfo
      await userService.saveUserFile(event.pathParameters.userId, fileInfo)
      return 'OK'
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/business/users/{userId}/files/{fileId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.fileId
    ) {
      await userService.deleteUserFile(
        event.pathParameters.userId,
        event.pathParameters.fileId
      )
      return 'OK'
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
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3Client(event)
    const client = await connectToDB()
    const userRepository = new UserRepository(tenantId, {
      mongoDb: client,
    })
    const userService = new UserService(
      userRepository,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    if (event.httpMethod === 'GET' && event.path.endsWith('/consumer/users')) {
      const { limit, skip, afterTimestamp, beforeTimestamp, filterId } =
        event.queryStringParameters as any
      return userService.getConsumerUsers({
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
      const user = await userService.getConsumerUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/consumer/users/{userId}/files' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const fileInfo = JSON.parse(event.body) as FileInfo
      await userService.saveUserFile(event.pathParameters.userId, fileInfo)
      return 'OK'
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/consumer/users/{userId}/files/{fileId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.fileId
    ) {
      await userService.deleteUserFile(
        event.pathParameters.userId,
        event.pathParameters.fileId
      )
      return 'OK'
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

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, role } = event.requestContext.authorizer
    const config = process.env as AccountsConfig

    const accountsService = new AccountsService(config)

    if (event.httpMethod === 'GET' && event.resource === '/accounts') {
      const tenant = await accountsService.getAccountTenant(userId)

      // todo: this call can only return up to 1000 users, need to handle this
      const accounts: Account[] = await accountsService.getTenantAccounts(
        tenant
      )
      return accounts
    } else if (event.httpMethod === 'POST' && event.resource === '/accounts') {
      assertRole(role, 'admin')
      if (event.body == null) {
        throw new Error(`Body should not be empty`)
      }
      // todo: validate
      const { email, password } = JSON.parse(event.body)

      const organization = await accountsService.getAccountTenant(userId)
      const user = await accountsService.createAccountInOrganization(
        organization,
        {
          email,
          password,
          role: 'user',
        }
      )

      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/accounts/{userId}/change_tenant'
    ) {
      assertRole(role, 'root')
      const { pathParameters } = event
      const idToChange = pathParameters?.userId
      if (!idToChange) {
        throw new Error(`userId is not provided`)
      }
      if (event.body == null) {
        throw new Error(`Body should not be empty`)
      }
      const { newTenantId } = JSON.parse(event.body) as ChangeTenantPayload
      const oldTenant = await accountsService.getAccountTenant(idToChange)
      console.log('oldTenant', JSON.stringify(oldTenant))
      const newTenant = await accountsService.getTenantById(newTenantId)
      if (newTenant == null) {
        throw new BadRequest(`Unable to find tenant by id: ${newTenantId}`)
      }
      console.log('newTenant', JSON.stringify(newTenant))
      await accountsService.changeUserTenant(oldTenant, newTenant, userId)
      return true
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/accounts/{userId}'
    ) {
      const { pathParameters } = event
      assertRole(role, 'admin')

      const idToDelete = pathParameters?.userId
      if (!idToDelete) {
        throw new Error(`userId is not provided`)
      }

      const organization = await accountsService.getAccountTenant(userId)
      await accountsService.deleteUser(organization, idToDelete)
      return true
    }

    throw new BadRequest('Unhandled request')
  }
)

export const tenantsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { role } = event.requestContext.authorizer
    assertRole(role, 'root')

    const config = process.env as AccountsConfig
    const accountsService = new AccountsService(config)

    if (event.httpMethod === 'GET' && event.resource === '/tenants') {
      const tenants: ApiTenant[] = (await accountsService.getTenants()).map(
        (tenant: Tenant): ApiTenant => ({
          id: tenant.id,
          name: tenant.name,
        })
      )
      return tenants
    }
    throw new BadRequest('Unhandled request')
  }
)

export const riskClassificationHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, role } = event.requestContext.authorizer
    assertRole(role, 'root')
    const dynamoDb = getDynamoDbClient(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/pulse/risk-classification'
    ) {
      try {
        return riskRepository.getRiskClassification()
      } catch (e) {
        console.error(e)
        return e
      }
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/pulse/risk-classification'
    ) {
      if (!event.body) {
        throw new BadRequest('Empty body')
      }
      let classificationValues
      try {
        classificationValues = JSON.parse(event.body)
        validateClassificationRequest(classificationValues)
      } catch (e) {
        throw new BadRequest('Invalid Request')
      }
      const result = await riskRepository.createOrUpdateRiskClassification(
        classificationValues
      )
      return result.classificationValues
    }
    throw new BadRequest('Unhandled request')
  }
)

const validateClassificationRequest = (classificationValues: Array<any>) => {
  if (
    classificationValues.length !=
    HammerheadStackConstants.NUMBER_OF_RISK_LEVELS
  ) {
    throw new BadRequest('Invalid Request - Please provide 5 risk levels')
  }
  const unique = new Set()
  const hasDuplicate = classificationValues.some(
    (element) => unique.size === unique.add(element.riskLevel).size
  )
  if (hasDuplicate) {
    throw new BadRequest('Invalid request - duplicate risk levels')
  }
}

export const manualRiskAssignmentHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, role } = event.requestContext.authorizer
    const { userId } = event.queryStringParameters as any
    assertRole(role, 'root')
    const dynamoDb = getDynamoDbClient(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/pulse/manual-risk-assignment'
    ) {
      if (!event.body) {
        throw new BadRequest('Empty body')
      }
      let riskLevel
      try {
        riskLevel = JSON.parse(event.body)
      } catch (e) {
        throw new BadRequest('Invalid Request')
      }
      return riskRepository.createOrUpdateManualDRSRiskItem(userId, riskLevel)
    }
    throw new BadRequest('Unhandled request')
  }
)

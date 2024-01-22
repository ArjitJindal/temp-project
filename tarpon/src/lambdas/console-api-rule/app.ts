import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

import { NotFound } from 'http-errors'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleAuditLogService } from '@/services/rules-engine/rules-audit-log-service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTransactionRuleEntityVariables } from '@/services/rules-engine/v8-variables'

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb, mongoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

    const handlers = new Handlers()

    handlers.registerGetRuleLogicConfig(async () => {
      return {
        variables: Object.values(getTransactionRuleEntityVariables()),
        operators: [],
        functions: [],
      }
    })

    handlers.registerGetRules(async () => await ruleService.getAllRules())

    handlers.registerGetRuleFilters(async () => {
      return await ruleService.getAllRuleFilters()
    })

    handlers.registerPostRules(
      async (ctx, request) => await ruleService.createOrUpdateRule(request.Rule)
    )

    handlers.registerPutRuleRuleId(async (ctx, request) => {
      await ruleService.createOrUpdateRule({
        ...request.Rule,
        id: request.ruleId,
      })
      return
    })

    handlers.registerDeleteRulesRuleId(
      async (ctx, request) => await ruleService.deleteRule(request.ruleId)
    )

    handlers.registerGetRulesSearch(async (ctx, request) => {
      const { queryStr = '', ...rest } = request

      return await ruleService.searchRules(queryStr, rest)
    })

    return await handlers.handle(event)
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
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)
    const rulesAuditLogService = new RuleAuditLogService(tenantId)

    const handlers = new Handlers()

    handlers.registerGetRuleInstances(
      async () => await ruleService.getAllRuleInstances()
    )

    handlers.registerPutRuleInstancesRuleInstanceId(async (ctx, request) => {
      const oldRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
        request.ruleInstanceId
      )
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance({
        id: request.ruleInstanceId,
        ...request.RuleInstance,
        // NOTE: We don't allow updating rule stats from Console
        hitCount: oldRuleInstance?.hitCount,
        runCount: oldRuleInstance?.runCount,
      })
      if (oldRuleInstance?.queueId !== newRuleInstance.queueId) {
        await alertsRepository.updateRuleQueue(
          request.ruleInstanceId,
          newRuleInstance.queueId
        )
      }
      await rulesAuditLogService.handleAuditLogForRuleInstanceUpdated(
        oldRuleInstance,
        newRuleInstance
      )
      return newRuleInstance
    })

    handlers.registerDeleteRuleInstancesRuleInstanceId(async (ctx, request) => {
      const oldRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
        request.ruleInstanceId
      )
      if (!oldRuleInstance) {
        throw new NotFound('Rule instance not found')
      }
      await ruleService.deleteRuleInstance(request.ruleInstanceId)
      await rulesAuditLogService.handleAuditLogForRuleInstanceDeleted(
        oldRuleInstance
      )
      return
    })

    handlers.registerPostRuleInstances(async (ctx, request) => {
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance(
        request.RuleInstance
      )
      await rulesAuditLogService.handleAuditLogForRuleInstanceCreated(
        newRuleInstance
      )
      return newRuleInstance
    })

    return await handlers.handle(event)
  }
)

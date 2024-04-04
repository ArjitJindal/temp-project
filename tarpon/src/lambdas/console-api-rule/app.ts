import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTransactionRuleEntityVariables } from '@/services/rules-engine/v8-variables'
import { RULE_OPERATORS } from '@/services/rules-engine/v8-operators'
import { RULE_FUNCTIONS } from '@/services/rules-engine/v8-functions'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'

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
    const ruleService = new RuleService(tenantId, { dynamoDb, mongoDb })

    const handlers = new Handlers()

    handlers.registerGetRuleLogicConfig(async () => {
      return {
        variables: Object.values(getTransactionRuleEntityVariables()),
        operators: RULE_OPERATORS,
        functions: RULE_FUNCTIONS,
      }
    })

    handlers.registerGetRules(async () => await ruleService.getAllRules())

    handlers.registerGetRule(async (_ctx, request) => {
      return (await ruleService.getRuleById(request.ruleId)) ?? null
    })

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
    const ruleInstanceService = new RuleInstanceService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const handlers = new Handlers()

    handlers.registerGetRuleInstances(
      async () => await ruleInstanceService.getAllRuleInstances()
    )

    handlers.registerGetRuleInstancesItem(
      async (ctx, request) =>
        await ruleInstanceService.getRuleInstanceById(request.ruleInstanceId)
    )

    handlers.registerPutRuleInstancesRuleInstanceId(async (ctx, request) => {
      return await ruleInstanceService.putRuleInstance(
        request.ruleInstanceId,
        request.RuleInstance
      )
    })

    handlers.registerDeleteRuleInstancesRuleInstanceId(
      async (ctx, request) =>
        await ruleInstanceService.deleteRuleInstance(request.ruleInstanceId)
    )

    handlers.registerPostRuleInstances(
      async (ctx, request) =>
        await ruleInstanceService.createRuleInstance(request.RuleInstance)
    )

    return await handlers.handle(event)
  }
)

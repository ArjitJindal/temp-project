import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, NotFound } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { toPublicRule } from './utils'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleInstance as PublicRuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import {
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  USER_FILTERS,
} from '@/services/rules-engine/filters'
import { mergeObjects } from '@/utils/object'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'
import { Rule as PublicRule } from '@/@types/openapi-public-management/Rule'

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()

    const handlers = new Handlers()

    handlers.registerGetRules(async (ctx) => {
      const ruleService = new RuleService(ctx.tenantId, { dynamoDb, mongoDb })
      return (await ruleService.getAllRules()) as Array<PublicRule>
    })

    handlers.registerGetRuleFiltersSchema(async () => {
      const filters = [
        ...Object.values(USER_FILTERS),
        ...Object.values(TRANSACTION_FILTERS),
        ...Object.values(TRANSACTION_HISTORICAL_FILTERS),
      ].map((filterClass) => (filterClass.getSchema() as any)?.properties || {})
      return {
        type: 'object',
        properties: mergeObjects({}, ...filters),
      }
    })

    handlers.registerGetRulesRuleId(async (ctx, request) => {
      const ruleId = request.ruleId
      const ruleService = new RuleService(ctx.tenantId, { dynamoDb, mongoDb })
      const rule = await ruleService.getRuleById(ruleId)
      if (!rule) {
        throw new NotFound(`Rule ${ruleId} not found`)
      }
      return toPublicRule(rule)
    })

    return handlers.handle(event)
  }
)

async function getRuleInstanceOrThrow(
  ruleInstanceService: RuleInstanceService,
  ruleInstanceId: string
): Promise<RuleInstance> {
  const ruleInstance = await ruleInstanceService.getRuleInstanceById(
    ruleInstanceId
  )
  if (!ruleInstance) {
    throw new NotFound(`Rule instance ${ruleInstanceId} not found`)
  }
  return ruleInstance
}

export const ruleInstanceHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const ruleService = new RuleService(tenantId, { dynamoDb, mongoDb })
    const ruleInstanceService = new RuleInstanceService(tenantId, {
      dynamoDb,
      mongoDb,
    })

    const handlers = new Handlers()

    handlers.registerPostRuleInstancesRuleInstanceId(async (ctx, request) => {
      const ruleInstance = await getRuleInstanceOrThrow(
        ruleInstanceService,
        request.ruleInstanceId
      )

      const newRuleInstance: RuleInstance = {
        ...ruleInstance,
        ...request.RuleInstanceUpdatable,
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      }
      return (await ruleInstanceService.createRuleInstance(
        newRuleInstance
      )) as PublicRuleInstance
    })

    handlers.registerDeleteRuleInstancesRuleInstanceId(async (ctx, request) => {
      const ruleInstanceId = request.ruleInstanceId
      await ruleInstanceService.deleteRuleInstance(ruleInstanceId)
    })

    handlers.registerPostRuleInstances(async (ctx, request) => {
      const ruleInstance = request.RuleInstanceUpdatable as RuleInstance
      if (!ruleInstance.ruleId) {
        throw new BadRequest('ruleId is required')
      }
      const rule = await ruleService.getRuleById(ruleInstance.ruleId)
      if (!rule) {
        throw new BadRequest('Invalid rule ID')
      }
      const newRuleInstance = await ruleInstanceService.createRuleInstance({
        ...ruleInstance,
        type: rule.type,
        labels: rule.labels,
        checksFor: rule.checksFor,
        nature: rule.defaultNature,
        casePriority: rule.defaultCasePriority,
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      })
      return newRuleInstance as PublicRuleInstance
    })

    handlers.registerGetRuleInstances(async () => {
      return (await ruleInstanceService.getAllRuleInstances()) as Array<PublicRuleInstance>
    })

    return handlers.handle(event)
  }
)

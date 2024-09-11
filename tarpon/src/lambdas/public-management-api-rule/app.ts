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
import { RuleInstanceUpdatable } from '@/@types/openapi-public-management/RuleInstanceUpdatable'
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

export const ruleHandler = lambdaApi()(
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

    if (event.httpMethod === 'GET' && event.resource === '/rules') {
      return (await ruleService.getAllRules()).map((rule) => toPublicRule(rule))
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rule-filters-schema'
    ) {
      const filters = [
        ...Object.values(USER_FILTERS),
        ...Object.values(TRANSACTION_FILTERS),
        ...Object.values(TRANSACTION_HISTORICAL_FILTERS),
      ].map((filterClass) => (filterClass.getSchema() as any)?.properties || {})
      return {
        type: 'object',
        properties: mergeObjects({}, ...filters),
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rules/{ruleId}' &&
      event.pathParameters?.ruleId
    ) {
      const ruleId = event.pathParameters.ruleId
      const rule = await ruleService.getRuleById(ruleId)
      if (!rule) {
        throw new NotFound(`Rule ${ruleId} not found`)
      }
      return toPublicRule(rule)
    }

    throw new Error('Unhandled request')
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

    if (
      event.httpMethod === 'POST' &&
      event.resource === '/rule-instances/{ruleInstanceId}' &&
      event.pathParameters?.ruleInstanceId &&
      event.body
    ) {
      const ruleInstance = await getRuleInstanceOrThrow(
        ruleInstanceService,
        event.pathParameters.ruleInstanceId
      )
      const ruleInstanceUpdatable = JSON.parse(
        event.body
      ) as RuleInstanceUpdatable

      const newRuleInstance: RuleInstance = {
        ...ruleInstance,
        ...ruleInstanceUpdatable,
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      }
      return ruleInstanceService.createRuleInstance(newRuleInstance)
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/rule-instances/{ruleInstanceId}' &&
      event.pathParameters?.ruleInstanceId
    ) {
      const ruleInstanceId = event.pathParameters?.ruleInstanceId

      await ruleInstanceService.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/rule-instances' &&
      event.body
    ) {
      const ruleInstance = JSON.parse(event.body) as RuleInstanceUpdatable
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
      return newRuleInstance
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rule-instances'
    ) {
      return (await ruleInstanceService.getAllRuleInstances()) as ReadonlyArray<PublicRuleInstance>
    }

    throw new Error('Unhandled request')
  }
)

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import _ from 'lodash'
import { toPublicRule } from './utils'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstanceUpdatable } from '@/@types/openapi-public-management/RuleInstanceUpdatable'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleInstance as PublicRuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import {
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  USER_FILTERS,
} from '@/services/rules-engine/filters'

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

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
        properties: _.merge({}, ...filters),
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rules/{ruleId}' &&
      event.pathParameters?.ruleId
    ) {
      const ruleId = event.pathParameters.ruleId
      const rule = await ruleRepository.getRuleById(ruleId)
      if (!rule) {
        throw new NotFound(`Rule ${ruleId} not found`)
      }
      return toPublicRule(rule)
    }

    throw new Error('Unhandled request')
  }
)

async function getRuleInstanceOrThrow(
  ruleInstanceRepository: RuleInstanceRepository,
  ruleInstanceId: string
): Promise<RuleInstance> {
  const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
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
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

    if (
      event.httpMethod === 'POST' &&
      event.resource === '/rule-instances/{ruleInstanceId}' &&
      event.pathParameters?.ruleInstanceId &&
      event.body
    ) {
      const ruleInstance = await getRuleInstanceOrThrow(
        ruleInstanceRepository,
        event.pathParameters.ruleInstanceId
      )
      const ruleInstanceUpdatable = JSON.parse(
        event.body
      ) as RuleInstanceUpdatable
      const newRuleInstance = {
        ...ruleInstance,
        ...ruleInstanceUpdatable,
      }
      return ruleService.createOrUpdateRuleInstance(newRuleInstance)
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/rule-instances/{ruleInstanceId}' &&
      event.pathParameters?.ruleInstanceId
    ) {
      const ruleInstanceId = event.pathParameters?.ruleInstanceId
      const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
        ruleInstanceId
      )
      if (!ruleInstance) {
        throw new NotFound(`Rule instance ${ruleInstanceId} not found`)
      }
      await ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/rule-instances' &&
      event.body
    ) {
      const ruleInstance = JSON.parse(event.body) as PublicRuleInstance
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance(
        ruleInstance as RuleInstance
      )
      return newRuleInstance
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rule-instances'
    ) {
      return (await ruleService.getAllRuleInstances()) as ReadonlyArray<PublicRuleInstance>
    }

    throw new Error('Unhandled request')
  }
)

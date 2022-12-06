import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import _ from 'lodash'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import {
  TRANSACTION_FILTERS,
  USER_FILTERS,
} from '@/services/rules-engine/filters'
import { RuleAuditLogService } from '@/services/rules-engine/rules-audit-log-service'

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
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

    if (event.httpMethod === 'GET' && event.path.endsWith('/rules')) {
      const rules = await ruleService.getAllRules()
      return rules
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/rule-filters'
    ) {
      const filters = [
        ...Object.values(USER_FILTERS),
        ...Object.values(TRANSACTION_FILTERS),
      ].map((filterClass) => (filterClass.getSchema() as any)?.properties || {})
      return {
        type: 'object',
        properties: _.merge({}, ...filters),
      }
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
    const dynamoDb = getDynamoDbClientByEvent(event)
    const ruleRepository = new RuleRepository(tenantId, { dynamoDb })
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)
    const ruleInstanceId = event.pathParameters?.ruleInstanceId
    const rulesAuditLogService = new RuleAuditLogService(tenantId)
    if (event.httpMethod === 'PUT' && ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      const oldRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
        ruleInstanceId
      )
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance({
        id: ruleInstanceId,
        ...JSON.parse(event.body),
      })
      await rulesAuditLogService.handleAuditLogForRuleInstanceUpdated(
        oldRuleInstance,
        newRuleInstance
      )
      return 'OK'
    } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
      const oldRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
        ruleInstanceId
      )
      if (oldRuleInstance != null) {
        await ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
        await rulesAuditLogService.handleAuditLogForRuleInstanceDeleted(
          oldRuleInstance
        )
      }
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/rule_instances') &&
      event.body
    ) {
      const newRuleInstance = await ruleService.createOrUpdateRuleInstance(
        JSON.parse(event.body)
      )
      await rulesAuditLogService.handleAuditLogForRuleInstanceCreated(
        newRuleInstance
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

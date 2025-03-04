import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import {
  RuleHitQuestion,
  RuleHitResponse,
} from '@/services/copilot/questions/types'
import { AlertsRepository } from '@/services/alerts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

export const RuleHit: RuleHitQuestion<any> = {
  type: 'RULE_LOGIC',
  questionId: COPILOT_QUESTIONS.RULE_LOGIC,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ alertId }) => {
    return `Rule Logic for ${alertId}`
  },
  aggregationPipeline: async ({ alertId, tenantId }) => {
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb: await getMongoDbClient(),
      dynamoDb: getDynamoDbClient(),
    })
    const alert = await alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new Error('Alert not found')
    }
    const ruleInstanceService = new RuleInstanceRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    const ruleInstance = await ruleInstanceService.getRuleInstanceById(
      alert.ruleInstanceId
    )
    const result: RuleHitResponse = {
      hitRulesDetails: {
        ruleId: alert.ruleId,
        ruleInstanceId: alert.ruleInstanceId,
        ruleName: alert.ruleName,
        ruleDescription: alert.ruleDescription,
        ruleAction: alert.ruleAction,
      },
    }
    if (ruleInstance) {
      const logic = ruleInstance.logic
      result.ruleType = ruleInstance?.type
      result.ruleLogic = logic
      result.logicAggregationVariables =
        ruleInstance.logicAggregationVariables ?? []
      result.logicEntityVariables = ruleInstance.logicEntityVariables ?? []
      result.logicMlVariables = ruleInstance.logicMachineLearningVariables ?? []
    }
    const resultMap = Object.keys(result).map((key) => {
      return {
        key,
        value: result[key],
      }
    })
    return {
      data: resultMap,
      summary: `Rule hit for ${alertId}`,
    }
  },
  variableOptions: {},
  defaults: ({ alertId }) => {
    return { alertId }
  },
}

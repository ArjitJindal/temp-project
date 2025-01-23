import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { AggregationRepository } from '@/services/logic-evaluator/engine/aggregation-repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const activeRuleInstances =
    await ruleInstanceRepository.getActiveRuleInstances()
  const deployingRuleInstances =
    await ruleInstanceRepository.getDeployingRuleInstances()
  const ruleInstances = [...activeRuleInstances, ...deployingRuleInstances]
  const aggregationRepository = new AggregationRepository(tenant.id, dynamoDb)
  const defaultVersion = Date.now()
  for (const ruleInstance of ruleInstances) {
    if (!ruleInstance.id) {
      logger.info(`RuleInstance ${ruleInstance.id} has no id`)
      continue
    }
    if (ruleInstance.logicAggregationVariables) {
      for (const aggregationVariable of ruleInstance.logicAggregationVariables) {
        const usedAggVar = await aggregationRepository.getUsedAggVar(
          aggregationVariable,
          aggregationVariable.version ?? defaultVersion
        )
        if (usedAggVar.usedEntityIds?.includes(ruleInstance.id)) {
          logger.info(
            `RuleInstance ${ruleInstance.id} already exists in usedAggVar ${usedAggVar.usedEntityIds}`
          )
        } else {
          logger.info(
            `Adding RuleInstance ${
              ruleInstance.id
            } to usedAggVar ${JSON.stringify(usedAggVar.usedEntityIds ?? [])}`
          )
          await aggregationRepository.updateOrCreateUsedAggVar(usedAggVar, [
            ...(usedAggVar.usedEntityIds ?? []),
            ruleInstance.id,
          ])
        }
      }
    }
  }
  logger.info(`Updated ${ruleInstances.length} rule instances`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

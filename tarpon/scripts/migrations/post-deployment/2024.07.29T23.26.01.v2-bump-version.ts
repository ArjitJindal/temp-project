import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import {
  TRANSACTION_RULES,
  TransactionRuleBase,
} from '@/services/rules-engine/transaction-rules'
import { TransactionAggregationRule } from '@/services/rules-engine/transaction-rules/aggregation-rule'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, { dynamoDb })
  const activeRuleInstances = await ruleInstanceRepo.getActiveRuleInstances(
    'TRANSACTION'
  )
  const activeV2Rules = activeRuleInstances.filter(
    (v) => !v.ruleId?.startsWith('RC')
  )
  for (const ruleInstance of activeV2Rules) {
    const rule = getRuleByRuleId(ruleInstance.ruleId as string)
    const RuleClass = TRANSACTION_RULES[rule.ruleImplementationName as string]
    const r = new (RuleClass as typeof TransactionRuleBase)(
      tenant.id,
      {} as any,
      { parameters: ruleInstance.parameters, filters: {} },
      { ruleInstance, rule: rule },
      {} as any,
      'DYNAMODB',
      dynamoDb
    )
    if (r instanceof TransactionAggregationRule) {
      if (r.shouldUseAggregation()) {
        if (r.getAggregationGranularity() !== 'hour') {
          // Bump version to trigger rebuild
          await ruleInstanceRepo.createOrUpdateRuleInstance(
            ruleInstance,
            (ruleInstance.updatedAt || 0) + 1
          )
        }
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

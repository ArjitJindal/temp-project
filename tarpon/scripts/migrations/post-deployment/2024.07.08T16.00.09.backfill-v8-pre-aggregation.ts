import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import dayjs from '@/utils/dayjs'
import {
  ruleInstanceAggregationVariablesRebuild,
  runOnV8Engine,
} from '@/services/rules-engine/utils'

async function migrateTenant(tenant: Tenant) {
  const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, {
    dynamoDb: getDynamoDbClient(),
  })

  const targetRuleInstances = (
    await ruleInstanceRepo.getAllRuleInstances()
  ).filter(
    (ruleInstance) =>
      ruleInstance.status !== 'INACTIVE' &&
      runOnV8Engine(ruleInstance) &&
      ((ruleInstance.createdAt &&
        // The time when https://github.com/flagright/orca/pull/4234 was deployed
        ruleInstance.createdAt < dayjs('2024-07-04T12:00:00.000Z').valueOf()) ||
        // We incorrectly skipped pre-aggregation if there're more than 1 aggregation variables
        (ruleInstance.logicAggregationVariables &&
          ruleInstance.logicAggregationVariables.length > 1))
  )

  for (const ruleInstance of targetRuleInstances) {
    await ruleInstanceAggregationVariablesRebuild(
      ruleInstance,
      0,
      tenant.id,
      ruleInstanceRepo,
      { updateRuleInstanceStatus: false }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

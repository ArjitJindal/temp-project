import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const allRuleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of allRuleInstances) {
    if (ruleInstance.ruleId === 'R-169' || ruleInstance.ruleId === 'R-170') {
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...ruleInstance,
        parameters: {
          ...ruleInstance.parameters,
          ruleStages: ['INITIAL', 'UPDATE'],
        },
        ...(Object.keys(ruleInstance.riskLevelParameters ?? {}).length !== 0
          ? {
              riskLevelParameters: {
                VERY_HIGH: {
                  ...ruleInstance.riskLevelParameters?.VERY_HIGH,
                  ruleStages: ['INITIAL', 'UPDATE'],
                },
                HIGH: {
                  ...ruleInstance.riskLevelParameters?.HIGH,
                  ruleStages: ['INITIAL', 'UPDATE'],
                },
                MEDIUM: {
                  ...ruleInstance.riskLevelParameters?.MEDIUM,
                  ruleStages: ['INITIAL', 'UPDATE'],
                },
                LOW: {
                  ...ruleInstance.riskLevelParameters?.LOW,
                  ruleStages: ['INITIAL', 'UPDATE'],
                },
                VERY_LOW: {
                  ...ruleInstance.riskLevelParameters?.VERY_LOW,
                  ruleStages: ['INITIAL', 'UPDATE'],
                },
              },
            }
          : {}),
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}

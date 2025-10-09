import get from 'lodash/get'
import set from 'lodash/set'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function updateRuleInstances(ruleIds: string[], tenantId: string) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  const targetRuleInstances = ruleInstances.filter(
    (ruleInstance) =>
      ruleInstance.ruleId && ruleIds.includes(ruleInstance.ruleId)
  )

  for (const ruleInstance of targetRuleInstances) {
    let shouldUpdate = false
    const updatedRuleInstance = { ...ruleInstance }

    const hasOngoingScreening = ruleInstance.parameters?.ongoingScreening
    const ruleStages = ruleInstance.parameters?.ruleStages
    const hasValidRuleStages = ruleStages && ruleStages.length > 0

    if (hasOngoingScreening || !hasValidRuleStages) {
      const updatedParameters = {
        ...ruleInstance.parameters,
        ruleStages: hasValidRuleStages
          ? ruleStages
          : hasOngoingScreening
          ? ['INITIAL', 'UPDATE', 'ONGOING']
          : ['INITIAL', 'UPDATE'],
      }
      updatedRuleInstance.parameters = updatedParameters
      shouldUpdate = true
    }

    if (ruleInstance.riskLevelParameters) {
      const updatedRiskLevelParameters = { ...ruleInstance.riskLevelParameters }

      for (const riskLevel in updatedRiskLevelParameters) {
        const riskParams = updatedRiskLevelParameters[riskLevel]
        const hasOngoingScreening = get(riskParams, 'ongoingScreening')
        const ruleStages = get(riskParams, 'ruleStages')
        const hasValidRuleStages = ruleStages && ruleStages.length > 0

        if (hasOngoingScreening || !hasValidRuleStages) {
          set(
            riskParams,
            'ruleStages',
            hasValidRuleStages
              ? ruleStages
              : hasOngoingScreening
              ? ['INITIAL', 'UPDATE', 'ONGOING']
              : ['INITIAL', 'UPDATE']
          )
          shouldUpdate = true
        }
      }

      updatedRuleInstance.riskLevelParameters = updatedRiskLevelParameters
    }

    if (shouldUpdate) {
      await ruleInstanceRepository.createOrUpdateRuleInstance(
        updatedRuleInstance
      )
    }
  }
}

async function migrateTenant(tenant: Tenant) {
  await updateRuleInstances(['R-17', 'R-32', 'R-128'], tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

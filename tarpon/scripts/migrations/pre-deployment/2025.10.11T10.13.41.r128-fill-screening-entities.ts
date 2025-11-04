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

  let updated = 0
  for (const targetRuleInstance of targetRuleInstances) {
    let isUpdated = false
    let updatedInstance = targetRuleInstance

    // Fix usual parameters
    if (
      updatedInstance.parameters.entityTypes == null ||
      updatedInstance.parameters.entityTypes.length === 0
    ) {
      updatedInstance = {
        ...updatedInstance,
        parameters: {
          ...updatedInstance.parameters,
          entityTypes: ['LEGAL_NAME', 'SHAREHOLDER', 'DIRECTOR'],
        },
      }
      isUpdated = true
    }

    // Fix risk-level parameters
    if (updatedInstance.riskLevelParameters) {
      const updatedRiskLevelParameters = {
        ...updatedInstance.riskLevelParameters,
      }
      for (const [riskLevel, parameters] of Object.entries(
        targetRuleInstance.riskLevelParameters ?? {}
      )) {
        if (
          parameters.entityTypes == null ||
          parameters.entityTypes.length === 0
        ) {
          isUpdated = true
          updatedRiskLevelParameters[riskLevel] = {
            ...parameters,
            entityTypes: ['LEGAL_NAME', 'SHAREHOLDER', 'DIRECTOR'],
          }
        }
      }
      updatedInstance = {
        ...updatedInstance,
        riskLevelParameters: updatedRiskLevelParameters,
      }
    }

    // If the rule instance is updated, update it in the database
    if (isUpdated) {
      console.log(
        `Updating rule ${targetRuleInstance.id} (${targetRuleInstance.ruleNameAlias})`
      )
      await ruleInstanceRepository.createOrUpdateRuleInstance(updatedInstance)
      updated++
    }
  }
  console.log(`Updated ${updated} rule instances`)
}

async function migrateTenant(tenant: Tenant) {
  await updateRuleInstances(['R-128'], tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

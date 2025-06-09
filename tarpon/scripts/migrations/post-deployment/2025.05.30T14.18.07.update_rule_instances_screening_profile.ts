import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { SanctionsService } from '@/services/sanctions'
import { ScreeningProfileService } from '@/services/screening-profile'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const ruleInstanceService = new RuleInstanceService(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const allowedRulesIds = ['R-17', 'R-32', 'R-128', 'R-169', 'R-170']
  const ruleInstances = await ruleInstanceService.getAllRuleInstances()
  const filteredRuleInstances = ruleInstances.result.filter(
    (ruleInstance) =>
      ruleInstance.ruleId && allowedRulesIds.includes(ruleInstance.ruleId)
  )
  if (filteredRuleInstances.length === 0) {
    return
  }
  const sanctionsService = new SanctionsService(tenant.id)
  const screeningProfileService = new ScreeningProfileService(
    tenant.id,
    sanctionsService
  )
  const screeningProfiles = await screeningProfileService.getScreeningProfiles(
    dynamoDb
  )
  const defaultScreeningProfileId = screeningProfiles.items.find(
    (profile) => profile.isDefault
  )?.screeningProfileId

  for (const ruleInstance of filteredRuleInstances) {
    let shouldUpdate = false
    const updatedRuleInstance = { ...ruleInstance }

    // Update main parameters
    if (!ruleInstance.parameters?.screeningProfileId) {
      const updatedParameters = {
        ...ruleInstance.parameters,
        screeningProfileId: defaultScreeningProfileId,
      }
      updatedRuleInstance.parameters = updatedParameters
      shouldUpdate = true
    }

    // Update risk level parameters
    if (ruleInstance.riskLevelParameters) {
      const updatedRiskLevelParameters = { ...ruleInstance.riskLevelParameters }

      for (const riskLevel in updatedRiskLevelParameters) {
        const riskParams = updatedRiskLevelParameters[riskLevel]
        if (!riskParams.screeningProfileId) {
          riskParams.screeningProfileId = defaultScreeningProfileId
          shouldUpdate = true
        }
      }

      updatedRuleInstance.riskLevelParameters = updatedRiskLevelParameters
    }

    if (shouldUpdate) {
      await ruleInstanceService.createOrUpdateRuleInstance(updatedRuleInstance)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const paymentDetailsScreeningRuleInstances = (
    await ruleInstanceRepository.getAllRuleInstances()
  ).filter((r) => r.ruleId === 'R-169' || r.ruleId === 'R-170')
  const updatedRules = paymentDetailsScreeningRuleInstances.map((r) => {
    return {
      ...r,
      parameters: {
        ...r.parameters,
        screeningFields: ['NAME'],
      },
      ...(r.riskLevelParameters
        ? {
            riskLevelParameters: addScreeningFields(r.riskLevelParameters),
          }
        : {}),
    }
  })
  await Promise.all(
    updatedRules.map((r) =>
      ruleInstanceRepository.createOrUpdateRuleInstance(r, r?.updatedAt)
    )
  )
}

function addScreeningFields(riskLevelParameters: RiskLevelRuleParameters) {
  for (const key of Object.keys(riskLevelParameters)) {
    if (!riskLevelParameters[key].screeningFields) {
      riskLevelParameters[key].screeningFields = ['NAME']
    }
  }
  return riskLevelParameters
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

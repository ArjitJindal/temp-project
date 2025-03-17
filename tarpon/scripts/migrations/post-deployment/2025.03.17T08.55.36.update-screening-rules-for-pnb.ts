import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'pnb') {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const r18s = (await ruleInstanceRepository.getAllRuleInstances()).filter(
    (r) => r.ruleId === 'R-18'
  )
  const updatedR18s = r18s.map((r) => {
    return {
      ...r,
      parameters: {
        ...r.parameters,
        isActive: true,
      },
      riskLevelParameters: addIsActiveParam(r.riskLevelParameters),
    }
  })
  await Promise.all(
    updatedR18s.map((r) =>
      ruleInstanceRepository.createOrUpdateRuleInstance(r, r.updatedAt)
    )
  )
}
function addIsActiveParam(riskLevelParameters) {
  for (const key of Object.keys(riskLevelParameters)) {
    riskLevelParameters[key].isActive = true
  }
  return riskLevelParameters
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

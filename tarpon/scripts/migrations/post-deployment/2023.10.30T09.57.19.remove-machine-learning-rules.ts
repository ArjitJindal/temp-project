import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'

const RULES_TO_DELETE = ['R-100', 'R-101', 'R-102', 'R-103'] as const

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()

  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })

  await Promise.all(
    RULES_TO_DELETE.map(async (ruleId) => {
      await ruleRepository.deleteRule(ruleId)
    })
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

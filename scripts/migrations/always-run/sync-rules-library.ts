import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { TRANSACTION_RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'
import { getDynamoDbClient } from '@/utils/dynamodb'

export async function syncRulesLibrary() {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  for (const rule of TRANSACTION_RULES_LIBRARY) {
    await ruleRepository.createOrUpdateRule(rule)
    console.info(`Synced rule ${rule.id} (${rule.name})`)
  }
}

if (require.main === module) {
  syncRulesLibrary()
}

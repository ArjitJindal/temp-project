import { getDynamoDbClient } from './utils/db'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { TRANSACTION_RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'

async function syncRulesLibrary() {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  for (const getRule of TRANSACTION_RULES_LIBRARY) {
    const rule = getRule()
    await ruleRepository.createOrUpdateRule(rule)
    console.info(`Synced rule ${rule.id} (${rule.name})`)
  }
}

syncRulesLibrary()

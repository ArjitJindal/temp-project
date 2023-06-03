import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function main() {
  const dynamodb = await getDynamoDbClient()
  const ruleRepo = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb: dynamodb,
  })
  const rules = await ruleRepo.getAllRules()
  for (const rule of rules) {
    console.log(`Migrate rule ${rule.id}`)
    rule.defaultCasePriority = 'P1'
    await ruleRepo.createOrUpdateRule(rule)
  }
}

export const up = async () => {
  await main()
}

export const down = async () => {
  //skipped
}

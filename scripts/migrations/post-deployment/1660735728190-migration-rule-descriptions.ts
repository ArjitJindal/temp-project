import { TarponStackConstants } from '@cdk/constants'
import { getDynamoDbClient, getMongoDbClient } from '../utils/db'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

const changes = [
  {
    ruleId: 'R-2',
    template: 'Transaction amount is {{ format-money limit currency }} or more',
  },
  {
    ruleId: 'R-69',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'spending' 'receiving' }} {{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above their expected amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }}",
  },
]

async function migrateRules() {
  console.info(`Starting to migrate`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(
    TarponStackConstants.MONGO_DB_DATABASE_NAME
  )

  const ruleRepo = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb: dynamodb,
    mongoDb: mongodb,
  })

  for (const change of changes) {
    const rule = await ruleRepo.getRuleById(change.ruleId)
    if (rule) {
      console.log(`Migrate rule ${rule?.id}`)
      rule.descriptionTemplate = change.template
      await ruleRepo.createOrUpdateRule(rule)
    }
  }
  console.info(`Migration completed`)
}

migrateRules()

import { exit } from 'process'
import { TarponStackConstants } from '@cdk/constants'
import { getDynamoDbClient, getMongoDbClient } from './utils/db'
import { getConfig } from './utils/config'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'

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

const config = getConfig()

async function migrateTenant(tenant: Tenant) {
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(
    TarponStackConstants.MONGO_DB_DATABASE_NAME
  )

  const ruleRepo = new RuleRepository(tenant.id, {
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
  console.info(`Tenant migrated: ${tenant.id}`)
}

async function main() {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()

  for (const tenant of tenants) {
    await migrateTenant(tenant)
  }
}

main()
  .then(() => {
    console.info('Migration completed.')
    exit(0)
  })
  .catch((e) => {
    console.error(e)
    exit(1)
  })

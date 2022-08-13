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
    ruleId: 'R-1',
    template: "{{ if-sender 'Sender’s' 'Receiver’s' }} first transaction",
  },
  {
    ruleId: 'R-2',
    template:
      'Transaction amount is {{ usdLimit }} or more in USD or equivalent',
  },
  {
    ruleId: 'R-3',
    template:
      "User tried to {{ if-sender 'send' 'receive' }} money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.amount.country }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.payment.country }} prior",
  },
  {
    ruleId: 'R-5',
    template:
      'User made a transaction from an account which was dormant for {{ parameters.dormancyPeriodDays }} days',
  },
  {
    ruleId: 'R-22',
    template:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} card is issued from {{ if-sender origin.payment.country destination.payment.country }}, a blacklisted country",
  },
  {
    ruleId: 'R-30',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} has {{ if-sender 'sent' 'received' }} {{ transactionsDif }} transactions more than the daily limit of {{ parameters.transactionsLimit }}",
  },
  {
    ruleId: 'R-69',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'spending' 'receiving' }} {{ volumeDelta.transactionAmount }} {{ volumeDelta.transactionCurrency }} above their average amount of {{ volumeThreshold.transactionAmount }} {{ volumeThreshold.transactionCurrency }}",
  },
  {
    ruleId: 'R-84',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsDif }} more transactions above the limit of {{ parameters.transactionsLimit }} in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-85',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsDif }} more transactions above the limit of {{ parameters.transactionsLimit }} in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-86',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsDif }} more transactions above the limit of {{ parameters.transactionsLimit }} in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-87',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsDif }} more transactions above the limit of {{ parameters.transactionsLimit }} in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-114',
    template:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} card country {{ hitParty.payment.country }} is not whitelisted",
  },
  {
    ruleId: 'R-118',
    template:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} name does not match name on {{ if-sender 'sender’s' 'receiver’s' }} card ({{ cardFingerprint }})",
  },
  {
    ruleId: 'R-119',
    template:
      '{{ delta }} transactions above the limit of {{ parameters.transactionsLimit }} between same Sender and Receiver in {{ parameters.timeWindowInDays }} day(s)',
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

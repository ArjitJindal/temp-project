import { MigrationFn } from 'umzug'
import { StackConstants } from '@cdk/constants'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'

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
      "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'spending' 'receiving' }} {{ volumeDelta.transactionAmount }} {{ volumeDelta.transactionCurrency }} above their expected amount of {{ volumeThreshold.transactionAmount }} {{ volumeThreshold.transactionCurrency }}",
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

async function migrateRules() {
  console.info(`Starting to migrate`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

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

export const up: MigrationFn = async () => {
  await migrateRules()
}

export const down: MigrationFn = async () => {
  // skip
}

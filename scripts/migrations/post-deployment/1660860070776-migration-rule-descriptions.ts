import { getDynamoDbClient } from '../utils/db'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

const changes = [
  {
    ruleId: 'R-4',
    template:
      "User tried to {{ if-sender 'send' 'receive' }} money in {{ hitParty.amount.currency }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money in {{ hitParty.amount.currency }} prior",
  },
  {
    ruleId: 'R-6',
    template:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} currency ({{ hitParty.amount.currency }}) is a High Risk",
  },
  {
    ruleId: 'R-89',
    template:
      "An account is {{ if-sender 'receiving' 'sending' }} funds from >= {{ parameters.transactionsLimit }} different sender accounts in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-90',
    template:
      "An account is {{ if-sender 'receiving' 'sending' }} funds from >= {{ parameters.transactionsLimit }} different sender accounts in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-91',
    template:
      "An account is {{ if-sender 'receiving' 'sending' }} funds from >= {{ parameters.transactionsLimit }} different sender accounts in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-92',
    template:
      "An account is {{ if-sender 'receiving' 'sending' }} funds from >= {{ parameters.transactionsLimit }} different sender accounts in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)",
  },
  {
    ruleId: 'R-95',
    template:
      'Receiver received {{ parameters.transactionsLimit }} or more transactions in {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)',
  },
  {
    ruleId: 'R-109',
    template:
      'Receiver is receiving >= {{ format-money volumeThreshold }} in total within time {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)',
  },
  {
    ruleId: 'R-110',
    template:
      'Receiver is receiving >= {{ format-money volumeThreshold }} in total within time {{ parameters.timeWindow.units }} {{ parameters.timeWindow.granularity }}(s)',
  },
  {
    ruleId: 'R-75',
    template:
      "CTR required since {{ if-sender 'sending' 'receiving' }} {{ format-money hitParty.amount }} is above {{ format-money limit currency }}",
  },
  {
    ruleId: 'R-112',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} whose age is between {{ parameters.ageRange.minAge }} - {{ parameters.ageRange.maxAge }} {{ if-sender 'sent' 'received' }} {{ format-money hitParty.amount }} above the limit {{ format-money limit currency }}",
  },
  {
    ruleId: 'R-101',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ parameters.targetTransactionsThreshold }} or more crypto transactions without any fiat transactions",
  },
  {
    ruleId: 'R-10',
    template:
      'More than {{ parameters.sendersCount }} counterparties transacting with a single user over a set period of {{ parameters.timePeriodDays }} day(s)',
  },
  {
    ruleId: 'R-113',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsCount }} transactions from {{ locationsCount }} locations in more than {{ parameters.timeWindowInDays }} day(s)",
  },
  {
    ruleId: 'R-117',
    template:
      'Transaction amount of {{ format-money hitParty.amount }} matches a blacklisted pattern ending with {{ matchPattern }}',
  },
  {
    ruleId: 'R-13',
    template: '{{ receiverName }} is blacklisted',
  },
  {
    ruleId: 'R-24',
    template: 'Keyword “{{ keyword }}” in reference is blacklisted',
  },
  {
    ruleId: 'R-52',
    template:
      'Same ip address ({{ ipAddress }}) used by {{ uniqueUsersCount }} unique users',
  },
  {
    ruleId: 'R-53',
    template:
      'Same card ({{ cardFingerprint }}) used by {{ uniqueUserCount }} unique users',
  },
  {
    ruleId: 'R-54',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} used {{ uniqueCardsCount }} unique cards above the limit of {{ parameters.uniqueCardsCountThreshold }}",
  },
  {
    ruleId: 'R-99',
    template:
      "{{ if-sender 'Sender sent' 'Receiver received' }} a transaction amount of {{ format-money hitParty.amount }} more than the limit of {{ format-money transactionLimit }}",
  },
  {
    ruleId: 'R-88',
    template:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} ip-bases country ({{ format-country ipCountry }}) is not country of origin ({{ format-country hitParty.user.userDetails.countryOfResidence }}) or country of nationality ({{ format-country hitParty.user.userDetails.countryOfNationality }})",
  },
  {
    ruleId: 'R-9',
    template:
      'More than {{ parameters.sendersCount }} users transacting with a single counterparty over a set period of {{ parameters.timePeriodDays }} days',
  },
  {
    ruleId: 'R-8',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit",
  },
  {
    ruleId: 'R-7',
    template:
      "{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit",
  },
]

async function main() {
  console.log('Get dynamo client')
  const dynamodb = await getDynamoDbClient()
  console.log('Make rule repo')
  const ruleRepo = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb: dynamodb,
  })
  for (const change of changes) {
    const rule = await ruleRepo.getRuleById(change.ruleId)
    if (rule) {
      console.log(`Migrate rule ${rule?.id}`)
      rule.descriptionTemplate = change.template
      await ruleRepo.createOrUpdateRule(rule)
    }
  }
  console.info('Migration completed.')
}

main()

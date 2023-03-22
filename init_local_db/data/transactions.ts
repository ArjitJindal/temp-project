import {
  sampleBlockRuleResult,
  sampleFlagRuleResult,
  sampleNonHitRuleResult,
} from './samplers/rule_result'
import users from './users'
import { sampleTransaction } from './samplers/transaction'
import { sampleTag } from './samplers/tag'
import { sampleCountry } from './samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { prng } from '@/utils/prng'

const data: InternalTransaction[] = []

const hitRules: Array<ExecutedRulesResult> = [
  sampleBlockRuleResult(),
  sampleFlagRuleResult(),
]

const executedRules: ExecutedRulesResult[] = [
  ...hitRules,
  sampleNonHitRuleResult(),
]

const random = prng(42)

for (let i = 0; i < 100; i += 1) {
  const type =
    random() < 0.24 ? 'TRANSFER' : random() < 0.95 ? 'REFUND' : 'WITHDRAWAL'
  const status = random() < 0.24 ? 'BLOCK' : random() < 0.95 ? 'ALLOW' : 'FLAG'
  const transaction = sampleTransaction()
  data.push({
    ...transaction,
    type: type,
    timestamp:
      (transaction.timestamp as number) -
      Math.round(3600 * 1000 * 100 * i * random()),
    transactionId: `transaction-${i + 1}`,
    originUserId: users[0].userId,
    destinationUserId: users[1].userId,
    status: status,
    hitRules: i === 1 ? [] : hitRules.slice(0, i),
    executedRules: executedRules.slice(0, i),
    originAmountDetails: {
      country: sampleCountry(i),
      transactionCurrency: 'PHP' as const,
      transactionAmount:
        status === 'BLOCK'
          ? Math.round(random() * 5000)
          : Math.round(random() * 1000),
    },
    destinationAmountDetails: {
      country: sampleCountry(i + 1),
      transactionCurrency: 'PHP',
      transactionAmount: Math.round(random() * 1000),
    },
    tags: i < 3 ? [sampleTag(i)] : [],
  })
}

export = data

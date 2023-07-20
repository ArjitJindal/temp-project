import { data as users } from './users'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import { sampleTag } from '@/core/seed/samplers/tag'
import { sampleCountry } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { pickRandom, prng, randomFloat, randomInt } from '@/utils/prng'
import { randomRules, rules } from '@/core/seed/data/rules'
import { sampleCurrency } from '@/core/seed/samplers/currencies'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { TRANSACTION_STATES } from '@/@types/openapi-internal-custom/TransactionState'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'

const TXN_COUNT = 1000
const generator = function* (seed: number): Generator<InternalTransaction> {
  for (let i = 0; i < TXN_COUNT; i += 1) {
    const random = prng(seed * i)
    const type =
      random() < 0.24 ? 'TRANSFER' : random() < 0.95 ? 'REFUND' : 'WITHDRAWAL'
    let hitRules = randomRules()

    // Hack in some suspended transactions
    if (hitRules.find((hr) => hr.ruleAction === 'SUSPEND')) {
      hitRules = hitRules.filter(
        (hitRules) => hitRules.ruleAction === 'SUSPEND'
      )
    }

    const transaction = sampleTransaction({}, i)
    const originUserId = users[randomInt(random(), users.length)].userId

    const withoutOrigin = users.filter((u) => u.userId !== originUserId)
    const destinationUserId =
      withoutOrigin[randomInt(random(), withoutOrigin.length)].userId

    const transactionId = `T-${i + 1}`
    const timestamp = sampleTimestamp(i)

    const transactionAmount = Math.round(Math.random() * 5000)
    const fullTransaction: InternalTransaction = {
      ...transaction,
      type: type,
      timestamp,
      transactionId,
      originUserId,
      destinationUserId,
      status: getAggregatedRuleStatus(hitRules.map((hr) => hr.ruleAction)),
      hitRules,
      destinationPaymentMethodId: getPaymentMethodId(
        transaction?.destinationPaymentDetails
      ),
      originPaymentMethodId: getPaymentMethodId(
        transaction?.originPaymentDetails
      ),
      transactionState: pickRandom(TRANSACTION_STATES),
      arsScore: {
        transactionId,
        createdAt: timestamp,
        originUserId,
        destinationUserId,
        riskLevel: pickRandom(RISK_LEVEL1S),
        arsScore: Number((randomFloat(i * 2) * 100).toFixed(2)),
        components: [
          {
            entityType: 'TRANSACTION',
            score: randomFloat(100),
            parameter: 'some txn parameter',
            riskLevel: pickRandom(RISK_LEVEL1S),
            value: 'Some txn value',
          },
          {
            entityType: 'CONSUMER_USER',
            score: randomFloat(100),
            parameter: 'Some user parameter',
            riskLevel: pickRandom(RISK_LEVEL1S),
            value: 'Some user value',
          },
          {
            entityType: 'TRANSACTION',
            score: randomFloat(100),
            parameter: 'timestamp',
            riskLevel: pickRandom(RISK_LEVEL1S),
            value: timestamp,
          },
        ],
      },
      executedRules: rules,
      originAmountDetails: {
        country: sampleCountry(i),
        transactionCurrency: sampleCurrency(i),
        transactionAmount,
      },
      destinationAmountDetails: {
        country: sampleCountry(i + 1),
        transactionCurrency: sampleCurrency(i + 1),
        transactionAmount,
      },
      tags: i < 3 ? [sampleTag(i)] : [],
    }
    yield fullTransaction
  }
}

const generate: () => Iterable<InternalTransaction> = () => generator(42)

const transactions: InternalTransaction[] = []

export function internalToPublic(
  internal: InternalTransaction
): TransactionWithRulesResult {
  return {
    transactionId: internal.transactionId,
    timestamp: internal.timestamp,
    transactionState: internal.transactionState,
    executedRules: internal.executedRules,
    hitRules: internal.hitRules,
    status: internal.status,
    originPaymentDetails: internal.originPaymentDetails,
    destinationPaymentDetails: internal.destinationPaymentDetails,
    originAmountDetails: internal.originAmountDetails,
    destinationAmountDetails: internal.destinationAmountDetails,
    destinationUserId: internal.destinationUserId,
    originUserId: internal.originUserId,
    type: internal.type,
  }
}

const init = () => {
  if (transactions.length > 0) {
    return
  }
  const data = generate()
  for (const transaction of data) {
    transactions.push(transaction)
  }
}

export { init, generate, transactions }

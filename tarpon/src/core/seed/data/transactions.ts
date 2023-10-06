import { random } from 'lodash'
import { sampleTransactionRiskScoreComponents } from '../samplers/risk_score_components'
import { data as users } from './users'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import { sampleTag } from '@/core/seed/samplers/tag'
import { sampleCountry } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  pickRandom,
  randomFloat,
  randomInt,
  randomNumberGenerator,
  randomSubsetOfSize,
} from '@/core/seed/samplers/prng'
import { sampleCurrency } from '@/core/seed/samplers/currencies'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { TRANSACTION_STATES } from '@/@types/openapi-internal-custom/TransactionState'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import {
  randomTransactionRules,
  transactionRules,
} from '@/core/seed/data/rules'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'

const TXN_COUNT = process.env.SEED_TRANSACTIONS_COUNT
  ? Number(process.env.SEED_TRANSACTIONS_COUNT)
  : 50

const generator = function* (): Generator<InternalTransaction> {
  const userTransactionMap = new Map<string, string[]>()
  users.forEach((u) => {
    const filteredUsers = users.filter((thisU) => thisU.userId !== u.userId)
    const usersToTransactWith = randomSubsetOfSize(filteredUsers, 3)
    userTransactionMap.set(
      u.userId,
      usersToTransactWith.map((u) => u.userId)
    )
  })

  for (let i = 0; i < TXN_COUNT; i += 1) {
    const type = pickRandom(TRANSACTION_TYPES)

    // Hack in some suspended transactions for payment approvals
    const hitRules: ExecutedRulesResult[] =
      randomNumberGenerator() < 0.75
        ? randomTransactionRules()
        : transactionRules.filter((r) => r.ruleAction === 'SUSPEND')
    const randomHitRules = hitRules.map((hitRule) => {
      if (hitRule.ruleHitMeta?.falsePositiveDetails?.isFalsePositive === true) {
        const modifiedHitRule = {
          ...hitRule,
          ruleHitMeta: {
            ...hitRule.ruleHitMeta,
            falsePositiveDetails: {
              ...hitRule.ruleHitMeta.falsePositiveDetails,
              confidenceScore: random(59, 82),
            },
          },
        }
        return modifiedHitRule
      }
      return hitRule
    })
    const transaction = sampleTransaction({})
    const originUserId = users[i % users.length].userId
    const destinationUserId = pickRandom(
      userTransactionMap.get(originUserId) as string[]
    )

    const transactionId = `T-${i + 1}`
    const timestamp = sampleTimestamp()

    const transactionAmount = randomInt(1_00_000)
    const fullTransaction: InternalTransaction = {
      ...transaction,
      type: type,
      timestamp,
      transactionId,
      originUserId,
      destinationUserId,
      createdAt: timestamp,
      status: getAggregatedRuleStatus(hitRules.map((hr) => hr.ruleAction)),
      hitRules: randomHitRules,
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
        arsScore: Number(randomFloat(100).toFixed(2)),
        components: sampleTransactionRiskScoreComponents(transaction),
      },
      executedRules: transactionRules,
      originAmountDetails: {
        country: sampleCountry(),
        transactionCurrency: sampleCurrency(),
        transactionAmount,
      },
      destinationAmountDetails: {
        country: sampleCountry(),
        transactionCurrency: sampleCurrency(),
        transactionAmount,
      },
      tags: [sampleTag()],
    }
    yield fullTransaction
  }
}

const generate: () => Iterable<InternalTransaction> = () => generator()

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

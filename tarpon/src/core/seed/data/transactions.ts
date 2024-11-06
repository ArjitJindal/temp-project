import { compact, random, memoize, uniq } from 'lodash'
import { sampleTransactionRiskScoreComponents } from '../samplers/risk_score_components'
import {
  businessSanctionsSearch,
  consumerSanctionsSearch,
} from '../raw-data/sanctions-search'
import { getUsers, getUserUniqueTags } from './users'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from './sanctions'
import {
  samplePaymentDetails,
  sampleTransaction,
} from '@/core/seed/samplers/transaction'
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
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
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
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { envIs } from '@/utils/env'
import { isConsumerUser } from '@/services/rules-engine/utils/user-rule-utils'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'

export const TXN_COUNT = process.env.SEED_TRANSACTIONS_COUNT
  ? Number(process.env.SEED_TRANSACTIONS_COUNT)
  : envIs('local')
  ? 200
  : 50

const generator = function* (): Generator<InternalTransaction> {
  const userTransactionMap = new Map<string, string[]>()
  getUsers().forEach((u) => {
    const filteredUsers = getUsers().filter(
      (thisU) => thisU.userId !== u.userId
    )
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
        : transactionRules().filter((r) => r.ruleAction === 'SUSPEND')

    const transaction = sampleTransaction({})
    const originUser = getUsers()[i % getUsers().length]
    const originUserId = originUser.userId
    const destinationUserId = pickRandom(
      userTransactionMap.get(originUserId) as string[]
    )
    const destinationUser = getUsers().find(
      (u) => u.userId === destinationUserId
    ) as User | Business

    const getSanctionsSearch = (
      user: User | Business,
      ruleInstanceId: string,
      transactionId: string
    ): SanctionsDetails => {
      const isConsumer = isConsumerUser(user)
      const name = isConsumer
        ? `${(user as User).userDetails?.name?.firstName} ${
            (user as User).userDetails?.name?.middleName
          } ${(user as User).userDetails?.name?.lastName}`.trim()
        : (user as Business).legalEntity?.companyGeneralDetails?.legalName ?? ''

      const data = isConsumer
        ? consumerSanctionsSearch(
            name,
            user.userId,
            ruleInstanceId,
            transactionId,
            'EXTERNAL_USER'
          )
        : businessSanctionsSearch(
            name,
            user.userId,
            ruleInstanceId,
            transactionId,
            'EXTERNAL_USER'
          )

      getSanctions().push(data.historyItem)
      getSanctionsHits().push(...data.hits)
      getSanctionsScreeningDetails().push(data.screeningDetails)
      return {
        name,
        searchId: data.historyItem._id,
        entityType: isConsumer ? 'CONSUMER_NAME' : 'LEGAL_NAME',
        sanctionHitIds: data.hits.map((hit) => hit.searchId),
      }
    }
    const transactionId = `T-${i + 1}`
    const randomHitRules = hitRules.map((hitRule) => {
      if (hitRule.nature === 'SCREENING' && hitRule.ruleId === 'R-169') {
        const sanctionsDetails = [
          getSanctionsSearch(originUser, hitRule.ruleInstanceId, transactionId),
          getSanctionsSearch(
            destinationUser,
            hitRule.ruleInstanceId,
            transactionId
          ),
        ]

        return {
          ...hitRule,
          ruleHitMeta: {
            ...hitRule.ruleHitMeta,
            sanctionsDetails,
          },
        }
      }

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
      updatedAt: timestamp,
      status: getAggregatedRuleStatus(hitRules),
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
        riskLevel: pickRandom(RISK_LEVELS),
        arsScore: Number(randomFloat(100).toFixed(2)),
        components: sampleTransactionRiskScoreComponents(transaction),
      },
      executedRules: transactionRules(),
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

export const paymentMethods: () => PaymentDetails[] = memoize(() => {
  return [...Array(500000)].map(() => samplePaymentDetails() as PaymentDetails)
})

const generate: () => Iterable<InternalTransaction> = () => generator()

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

export const getTransactions: () => InternalTransaction[] = memoize(() => {
  return [...generate()]
})

export const getTransactionUniqueTags = memoize(() => {
  const transactions = getTransactions()
  return compact(uniq(transactions.flatMap((t) => t.tags?.map((t) => t.key))))
})

export const allUniqueTags: () => {
  tag: string
  type: 'TRANSACTION' | 'USER'
}[] = memoize(() => {
  const transactionTags = getTransactionUniqueTags()
  const userTags = getUserUniqueTags()

  return [
    ...transactionTags.map((t) => ({ tag: t, type: 'TRANSACTION' as const })),
    ...userTags.map((u) => ({ tag: u, type: 'USER' as const })),
  ]
})

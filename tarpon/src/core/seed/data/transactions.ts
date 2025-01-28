import { compact, random, memoize, uniq, shuffle } from 'lodash'
import { TransactionRiskScoreSampler } from '../samplers/risk_score_components'
import {
  BusinessSanctionsSearchSampler,
  ConsumerSanctionsSearchSampler,
} from '../raw-data/sanctions-search'
import { BaseSampler } from '../samplers/base'
import { getUserUniqueTags, users } from './users'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from './sanctions'
import { PAYMENT_METHODS_SEED, TRANSACTIONS_SEED } from './seeds'
import {
  PaymentDetailsSampler,
  TransactionSampler,
  UserPaymentDetailsSampler,
} from '@/core/seed/samplers/transaction'
import { TagSampler } from '@/core/seed/samplers/tag'
import { COUNTRIES } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { SAMPLE_CURRENCIES } from '@/core/seed/samplers/currencies'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { TRANSACTION_STATES } from '@/@types/openapi-internal-custom/TransactionState'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { RuleSampler, transactionRules } from '@/core/seed/data/rules'
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
  ? 500
  : 50

const ZERO_HIT_RATE_RULE_IDS = ['Es4Zmo', 'CK4Nh2']

interface TransactionPair {
  originUserId: string
  destinationUserId: string
}

export class FullTransactionSampler extends BaseSampler<InternalTransaction> {
  private userAccountMap: Map<
    string,
    {
      [key: string]: PaymentDetails
    }
  >
  private transactionSampler: TransactionSampler
  private tagSampler: TagSampler
  private transactionRiskScoreSampler: TransactionRiskScoreSampler
  private transactionPairs: TransactionPair[]
  private userTransactionCount: Map<string, number>
  private transactionIndex: number
  private ruleSampler: RuleSampler

  constructor(seed: number) {
    super(seed)

    this.ruleSampler = new RuleSampler(
      undefined,
      transactionRules(),
      [2, 5, 10, 13],
      TXN_COUNT,
      true
    )
    this.userAccountMap = new Map<
      string,
      {
        [key: string]: PaymentDetails
      }
    >()
    this.transactionPairs = []
    this.userTransactionCount = new Map<string, number>()
    this.transactionIndex = 0

    const userIds = users.map((u) => u.userId)

    // Initialize transaction count for each user
    userIds.forEach((id) => this.userTransactionCount.set(id, 0))

    let attempts = 0
    const maxAttempts = (TXN_COUNT + 10) * 5 // Safety limit to prevent infinite loops

    while (
      this.transactionPairs.length < TXN_COUNT + 10 &&
      attempts < maxAttempts
    ) {
      attempts++

      // Get users who have less than 6 transactions
      const availableUsers = shuffle(
        userIds.filter((id) => (this.userTransactionCount.get(id) || 0) < 6)
      )

      if (availableUsers.length < 2) {
        break // Not enough users with remaining transaction capacity
      }

      // Pick first two users from shuffled list
      const originUserId = availableUsers[0]
      const destinationUserId = availableUsers[1]

      // Add transaction pair
      this.transactionPairs.push({ originUserId, destinationUserId })

      // Update transaction counts
      this.userTransactionCount.set(
        originUserId,
        (this.userTransactionCount.get(originUserId) || 0) + 1
      )
      this.userTransactionCount.set(
        destinationUserId,
        (this.userTransactionCount.get(destinationUserId) || 0) + 1
      )
    }

    this.transactionSampler = new TransactionSampler()
    this.tagSampler = new TagSampler()
    this.transactionRiskScoreSampler = new TransactionRiskScoreSampler()
  }

  protected generateSample(transactionIdForRule: number): InternalTransaction {
    const type = this.rng.pickRandom(TRANSACTION_TYPES)

    // Hack in some suspended transactions for payment approvals
    const hitRules: ExecutedRulesResult[] = this.ruleSampler.getSample(
      undefined,
      transactionIdForRule
    )

    const numberoShadowRulesHit = (this.counter % 3) + 1
    const shadowRulesHit = hitRules
      .filter(
        (r) => r.isShadow && !ZERO_HIT_RATE_RULE_IDS.includes(r.ruleInstanceId)
      )
      .slice(0, numberoShadowRulesHit)

    if (this.transactionIndex >= this.transactionPairs.length) {
      this.transactionIndex = 0
    }

    const { originUserId, destinationUserId } =
      this.transactionPairs[this.transactionIndex++]

    let originUserPaymentDetails = this.userAccountMap.get(originUserId)
    let destinationUserPaymentDetails =
      this.userAccountMap.get(destinationUserId)

    // storing for future use
    if (!this.userAccountMap.get(originUserId)) {
      originUserPaymentDetails = new UserPaymentDetailsSampler().getSample()
      this.userAccountMap.set(originUserId, originUserPaymentDetails)
    }
    if (!this.userAccountMap.get(destinationUserId)) {
      destinationUserPaymentDetails =
        new UserPaymentDetailsSampler().getSample()
      this.userAccountMap.set(destinationUserId, destinationUserPaymentDetails)
    }

    const originUser = users.find((u) => u.userId === originUserId) as
      | User
      | Business

    const destinationUser = users.find(
      (u) => u.userId === destinationUserId
    ) as User | Business

    const transaction = this.transactionSampler.getSample(
      this.rng.randomInt(),
      {
        originUserId,
        destinationUserId,
        originUserPaymentDetails,
        destinationUserPaymentDetails,
      }
    )
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

      const sanctionsSearchSampler = isConsumer
        ? new ConsumerSanctionsSearchSampler(this.rng.randomInt())
        : new BusinessSanctionsSearchSampler(this.rng.randomInt())

      const data = sanctionsSearchSampler.getSample(
        undefined, // seed already assigned
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

    const transactionId = `T-${this.counter + 1}`
    const randomHitRules = [
      ...hitRules.filter((r) => !r.isShadow),
      ...shadowRulesHit,
    ]
      .filter((r) => !ZERO_HIT_RATE_RULE_IDS.includes(r.ruleInstanceId))
      .map((hitRule) => {
        if (hitRule.nature === 'SCREENING' && hitRule.ruleId === 'R-169') {
          const sanctionsDetails = [
            getSanctionsSearch(
              originUser,
              hitRule.ruleInstanceId,
              transactionId
            ),
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

        if (
          hitRule.ruleHitMeta?.falsePositiveDetails?.isFalsePositive === true
        ) {
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

    const timestamp = this.sampleTimestamp()

    const transactionAmount = this.rng.randomInt(1_00_000)
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
      originDeviceData: transaction?.originDeviceData,
      destinationDeviceData: transaction?.destinationDeviceData,
      transactionState: this.rng.pickRandom(TRANSACTION_STATES),
      arsScore: {
        transactionId,
        createdAt: timestamp,
        originUserId,
        destinationUserId,
        riskLevel: this.rng.pickRandom(RISK_LEVELS),
        arsScore: Number(this.rng.randomFloat(100).toFixed(2)),
        components: this.transactionRiskScoreSampler.getSample(
          undefined,
          transaction
        ),
      },
      executedRules: transactionRules(
        randomHitRules.map((r) => r.ruleInstanceId)
      ),
      originAmountDetails: {
        country: this.rng.r(2).pickRandom(COUNTRIES),
        transactionCurrency: this.rng.r(3).pickRandom(SAMPLE_CURRENCIES),
        transactionAmount,
      },
      destinationAmountDetails: {
        country: this.rng.r(4).pickRandom(COUNTRIES),
        transactionCurrency: this.rng.r(5).pickRandom(SAMPLE_CURRENCIES),
        transactionAmount,
      },
      tags: [this.tagSampler.getSample()],
    }
    return fullTransaction
  }
}

export const paymentMethods: () => PaymentDetails[] = memoize(() => {
  const paymentDetailsSampler = new PaymentDetailsSampler(PAYMENT_METHODS_SEED)
  return [...Array(500000)].map(
    () => paymentDetailsSampler.getSample() as PaymentDetails
  )
})

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
    originDeviceData: internal.originDeviceData,
    destinationAmountDetails: internal.destinationAmountDetails,
    destinationDeviceData: internal.destinationDeviceData,
    destinationUserId: internal.destinationUserId,
    originUserId: internal.originUserId,
    type: internal.type,
  }
}

export const getTransactions: () => InternalTransaction[] = memoize(() => {
  const fullTransactionSampler = new FullTransactionSampler(TRANSACTIONS_SEED)
  return [...Array(TXN_COUNT)].map((_, index) => {
    return fullTransactionSampler.getSample(undefined, index)
  })
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

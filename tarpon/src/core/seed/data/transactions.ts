import { compact, random, memoize, uniq, cloneDeep } from 'lodash'
import { TransactionRiskScoreSampler } from '../samplers/risk_score_components'
import {
  BusinessSanctionsSearchSampler,
  ConsumerSanctionsSearchSampler,
} from '../raw-data/sanctions-search'
import { BaseSampler } from '../samplers/base'
import { getUsers, getUserUniqueTags } from './users'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from './sanctions'
import { PAYMENT_METHODS_SEED, TRANSACTIONS_SEED } from './seeds'
import {
  PaymentDetailsSampler,
  TransactionSampler,
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
import { transactionRules } from '@/core/seed/data/rules'
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

const ZERO_HIT_RATE_RULE_IDS = ['Es4Zmo', 'CK4Nh2']

export class FullTransactionSampler extends BaseSampler<InternalTransaction> {
  private userTransactionMap: Map<string, string[]>
  private transactionSampler: TransactionSampler
  private tagSampler: TagSampler
  private transactionRiskScoreSampler: TransactionRiskScoreSampler

  constructor(seed: number) {
    super(seed)

    this.userTransactionMap = new Map<string, string[]>()

    // map each user to a random subset of users to transact with excluding themselves
    getUsers().forEach((u) => {
      const filteredUsers = getUsers().filter(
        (thisU) => thisU.userId !== u.userId
      )
      const usersToTransactWith = this.rng.randomSubsetOfSize(filteredUsers, 3)
      this.userTransactionMap.set(
        u.userId,
        usersToTransactWith.map((u) => u.userId)
      )
    })

    const childSamplerSeed = this.rng.randomInt()

    this.transactionSampler = new TransactionSampler(childSamplerSeed)
    this.tagSampler = new TagSampler(childSamplerSeed + 1)
    this.transactionRiskScoreSampler = new TransactionRiskScoreSampler(
      childSamplerSeed + 2
    )
  }

  protected generateSample(): InternalTransaction {
    const type = this.rng.pickRandom(TRANSACTION_TYPES)

    // Hack in some suspended transactions for payment approvals
    const hitRules: ExecutedRulesResult[] =
      this.rng.r(1).randomFloat() < 0.3
        ? cloneDeep(this.rng.randomSubset(transactionRules()))
        : this.rng.r(2).randomNumber() < 0.9 &&
          this.rng.r(2).randomNumber() > 0.8
        ? transactionRules().filter((r) => r.ruleAction === 'SUSPEND')
        : []

    const numberoShadowRulesHit = (this.counter % 3) + 1
    const shadowRulesHit = hitRules
      .filter(
        (r) => r.isShadow && !ZERO_HIT_RATE_RULE_IDS.includes(r.ruleInstanceId)
      )
      .slice(0, numberoShadowRulesHit)

    const transaction = this.transactionSampler.getSample()
    const originUser = getUsers()[this.counter % getUsers().length]
    const originUserId = originUser.userId
    const destinationUserId = this.rng.pickRandom(
      this.userTransactionMap.get(originUserId) as string[]
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
    destinationAmountDetails: internal.destinationAmountDetails,
    destinationUserId: internal.destinationUserId,
    originUserId: internal.originUserId,
    type: internal.type,
  }
}

export const getTransactions: () => InternalTransaction[] = memoize(() => {
  const fullTransactionSampler = new FullTransactionSampler(TRANSACTIONS_SEED)
  return [...Array(TXN_COUNT)].map(() => fullTransactionSampler.getSample())
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

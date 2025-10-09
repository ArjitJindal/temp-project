import random from 'lodash/random'
import memoize from 'lodash/memoize'
import shuffle from 'lodash/shuffle'
import { TRANSACTION_TYPES } from '@flagright/lib/utils'
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
import {
  ID_PREFIXES,
  PAYMENT_METHODS_SEED,
  TIME_BACK_TO_12_MONTH_WINDOW,
  TIME_BACK_TO_3_MONTH_WINDOW,
  TRANSACTIONS_SEED,
} from './seeds'
import {
  CryptoTransactionSampler,
  PaymentDetailsSampler,
  TransactionSampler,
  UserPaymentDetailsSampler,
} from '@/core/seed/samplers/transaction'
import { TagSampler } from '@/core/seed/samplers/tag'
import { COUNTRIES } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { SAMPLE_CURRENCIES } from '@/core/seed/samplers/currencies'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { getPaymentMethodId } from '@/utils/payment-details'
import { envIs } from '@/utils/env'
import { TRANSACTION_STATES } from '@/@types/openapi-internal-custom/TransactionState'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import {
  CounterPartyTransactionRuleSampler,
  CryptoTransactionRuleSampler,
  transactionRules,
  counterPartyTransactionRules,
  TransactionRuleSampler,
} from '@/core/seed/data/rules'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { getPaymentDetailsNameString } from '@/utils/helpers'
import { hasFeature } from '@/core/utils/context'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'

export const TXN_COUNT = process.env.SEED_TRANSACTIONS_COUNT
  ? Number(process.env.SEED_TRANSACTIONS_COUNT)
  : envIs('local')
  ? 500
  : 50

export const COUNTER_PARTY_TXN_COUNT = TXN_COUNT / 10

export const CRYPTO_TXN_COUNT = process.env.SEED_CRYPTO_TRANSACTIONS_COUNT
  ? Number(process.env.SEED_CRYPTO_TRANSACTIONS_COUNT)
  : 50

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
  private cryptoTransactionSampler: CryptoTransactionSampler
  private tagSampler: TagSampler
  private transactionRiskScoreSampler: TransactionRiskScoreSampler
  private transactionPairs: TransactionPair[]
  private userTransactionCount: Map<string, number>
  private transactionIndex: number
  private ruleSampler: TransactionRuleSampler = new TransactionRuleSampler()
  private cryptoTxnRuleSampler: CryptoTransactionRuleSampler =
    new CryptoTransactionRuleSampler()
  private counterPartyTxnRuleSampler: CounterPartyTransactionRuleSampler =
    new CounterPartyTransactionRuleSampler()

  constructor(seed: number) {
    super(seed)
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
    this.cryptoTransactionSampler = new CryptoTransactionSampler()
    this.tagSampler = new TagSampler()
    this.transactionRiskScoreSampler = new TransactionRiskScoreSampler()
  }

  protected generateSample(
    transactionIdForRule: number,
    isCryptoTransaction: boolean,
    isCounterPartyTransaction?: boolean
  ): InternalTransaction {
    const type = this.rng.pickRandom<string>([...TRANSACTION_TYPES])
    let counterPartyDirection: 'origin' | 'destination' | null = null

    if (isCounterPartyTransaction) {
      counterPartyDirection =
        this.rng.randomFloat(1) < 0.5 ? 'origin' : 'destination'
    }

    // Hack in some suspended transactions for payment approvals
    const hitRules: ExecutedRulesResult[] = isCounterPartyTransaction
      ? this.counterPartyTxnRuleSampler.generateSample(
          transactionIdForRule - TXN_COUNT - CRYPTO_TXN_COUNT + 1
        )
      : !isCryptoTransaction
      ? this.ruleSampler.generateSample(transactionIdForRule)
      : this.cryptoTxnRuleSampler.generateSample(
          transactionIdForRule - TXN_COUNT + 1
        )

    const numberoShadowRulesHit = (this.counter % 3) + 1
    const shadowRulesHit = hitRules
      .filter((r) => r.isShadow)
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

    const transaction = !isCryptoTransaction
      ? this.transactionSampler.getSample(this.rng.randomInt(), {
          originUserId,
          destinationUserId,
          originUserPaymentDetails,
          destinationUserPaymentDetails,
        })
      : this.cryptoTransactionSampler.getSample(this.rng.randomInt(), {
          originUserId,
          destinationUserId,
        })

    const getSanctionsSearch = (
      paymentDetails: PaymentDetails,
      userId: string,
      ruleInstanceId: string,
      transactionId: string
    ): SanctionsDetails[] => {
      const namesToSearch = getPaymentDetailsNameString(paymentDetails)
      const sanctionsDetails: SanctionsDetails[] = []

      for (const n of namesToSearch) {
        const { name, entityType } = n

        let sanctionsSearchSampler
        if (entityType === 'BANK_ACCOUNT_HOLDER_NAME') {
          sanctionsSearchSampler = new BusinessSanctionsSearchSampler()
        } else {
          sanctionsSearchSampler = new ConsumerSanctionsSearchSampler()
        }

        const data = sanctionsSearchSampler.getSample(
          undefined, // seed already assigned
          name,
          userId,
          ruleInstanceId,
          transactionId,
          entityType
        )

        getSanctions().push(data.historyItem)
        getSanctionsHits().push(...data.hits)
        getSanctionsScreeningDetails().push(data.screeningDetails)

        sanctionsDetails.push({
          name,
          searchId: data.historyItem._id,
          entityType,
          sanctionHitIds: data.hits.map((hit) => hit.sanctionsHitId),
        })
      }

      return sanctionsDetails
    }

    const transactionId = `${ID_PREFIXES.TRANSACTION}${this.counter + 1}`
    const randomHitRules = [
      ...hitRules.filter((r) => !r.isShadow),
      ...shadowRulesHit,
    ].map((hitRule) => {
      // correction of hit direction for counterparty transactions
      if (hitRule.ruleHitMeta && hitRule.ruleId === 'R-169') {
        let hitDirections = hitRule.ruleHitMeta.hitDirections
        if (counterPartyDirection === 'origin') {
          hitDirections = ['DESTINATION']
        } else if (counterPartyDirection === 'destination') {
          hitDirections = ['ORIGIN']
        }

        hitRule.ruleHitMeta = {
          ...hitRule.ruleHitMeta,
          hitDirections: hitDirections as RuleHitDirection[],
        }
      }

      if (hitRule.nature === 'SCREENING' && hitRule.ruleId === 'R-169') {
        const sanctionsDetails: SanctionsDetails[] = []

        if (
          counterPartyDirection === 'origin' ||
          counterPartyDirection === null
        ) {
          sanctionsDetails.push(
            ...getSanctionsSearch(
              transaction.originPaymentDetails as PaymentDetails,
              counterPartyDirection === 'origin'
                ? 'counterparty'
                : originUserId,
              hitRule.ruleInstanceId,
              transactionId
            )
          )
        }
        if (
          counterPartyDirection === 'destination' ||
          counterPartyDirection === null
        ) {
          sanctionsDetails.push(
            ...getSanctionsSearch(
              transaction.destinationPaymentDetails as PaymentDetails,
              counterPartyDirection === 'destination'
                ? 'counterparty'
                : destinationUserId,
              hitRule.ruleInstanceId,
              transactionId
            )
          )
        }

        return {
          ...hitRule,
          ruleHitMeta: {
            ...hitRule.ruleHitMeta,
            sanctionsDetails,
          },
        }
      }

      if (hitRule.ruleHitMeta?.falsePositiveDetails?.isFalsePositive === true) {
        const modifiedHitRule: HitRulesDetails = {
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
    const ruleHitIds = randomHitRules.map((ri) => ri.ruleInstanceId)

    const timestamp =
      this.rng.randomFloat(1) < 0.45
        ? this.sampleTimestamp(TIME_BACK_TO_3_MONTH_WINDOW)
        : this.sampleTimestamp(TIME_BACK_TO_12_MONTH_WINDOW)

    const transactionAmount = this.rng.randomInt(1_00_000)

    const executedRules = isCounterPartyTransaction
      ? counterPartyTransactionRules()
      : transactionRules(isCryptoTransaction)

    const fullTransaction: InternalTransaction = {
      ...transaction,
      type: type,
      timestamp,
      transactionId,
      originUserId:
        counterPartyDirection === 'origin' ? undefined : originUserId,
      destinationUserId:
        counterPartyDirection === 'destination' ? undefined : destinationUserId,
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
      transactionState:
        getAggregatedRuleStatus(hitRules) === 'SUSPEND'
          ? 'SUSPENDED'
          : this.rng.pickRandom(TRANSACTION_STATES),
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
      executedRules: executedRules.map((r) => ({
        ...r,
        ruleHit: ruleHitIds.includes(r.ruleInstanceId) ? true : false,
      })),
      ...(!isCryptoTransaction && {
        originDeviceData: transaction?.originDeviceData,
        destinationDeviceData: transaction?.destinationDeviceData,
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
      }),
      ...(counterPartyDirection === 'origin' && {
        originPaymentDetails: new PaymentDetailsSampler(
          this.rng.randomInt()
        ).getSample(),
      }),
      ...(counterPartyDirection === 'destination' && {
        destinationPaymentDetails: new PaymentDetailsSampler(
          this.rng.randomInt()
        ).getSample(),
      }),
    }

    if (counterPartyDirection === 'origin') {
      fullTransaction.destinationPaymentMethodId = undefined
    } else if (counterPartyDirection === 'destination') {
      fullTransaction.originPaymentMethodId = undefined
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
  let transactions = [...Array(TXN_COUNT)].map((_, index) => {
    return fullTransactionSampler.getSample(undefined, index, false)
  })
  // manullay changing txn status to suspend for cypress tenant
  if (process.env.TENANT_ID === 'cypress-tenant') {
    transactions.forEach((t, idx) => {
      if (idx % 10 === 0) {
        t.status = 'SUSPEND'
        t.transactionState = 'SUSPENDED'
      }
    })
  }
  if (hasFeature('CHAINALYSIS')) {
    const cryptoTransactions = [...Array(CRYPTO_TXN_COUNT)].map((_, index) => {
      return fullTransactionSampler.getSample(
        undefined,
        index + TXN_COUNT,
        true
      )
    })
    transactions = [...transactions, ...cryptoTransactions]
  }

  const counterParty = [...Array(COUNTER_PARTY_TXN_COUNT)].map((_, index) => {
    return fullTransactionSampler.getSample(
      undefined,
      index + TXN_COUNT + CRYPTO_TXN_COUNT,
      false,
      true
    )
  })
  transactions = [...transactions, ...counterParty]
  if (hasFeature('EDD')) {
    const businessUsers = users.filter((u) => u.type === 'BUSINESS')
    const eddTransactions = [...Array(50)].map((_, index) => {
      const transaction = fullTransactionSampler.getSample(
        undefined,
        index + TXN_COUNT + CRYPTO_TXN_COUNT + COUNTER_PARTY_TXN_COUNT,
        false,
        false,
        true
      )

      const originUser = businessUsers[index]
      const destinationUser = businessUsers[(index + 10) % businessUsers.length]
      transaction.originUserId = originUser.userId
      transaction.originUser = originUser
      transaction.destinationUserId = destinationUser.userId
      transaction.destinationUser = destinationUser
      transaction.hitRules =
        index % 2 === 0 ? [transaction.hitRules[0]] : [transaction.hitRules[1]]
      return transaction
    })
    transactions = [...transactions, ...eddTransactions]
  }

  return transactions
})

export const getTransactionUniqueTags: () => {
  key: string
  value: string
}[] = memoize(() => {
  const transactions = getTransactions()
  const uniqueSet = new Set<string>()
  const result: { key: string; value: string }[] = []

  transactions.forEach((t) => {
    t.tags?.forEach((tag) => {
      const uniqueKey = `${tag.key}:${tag.value}`
      if (!uniqueSet.has(uniqueKey)) {
        uniqueSet.add(uniqueKey)
        result.push({ key: tag.key, value: tag.value })
      }
    })
  })
  return result
})

export const allUniqueTags: () => {
  tag: string
  type: 'TRANSACTION' | 'USER'
}[] = memoize(() => {
  const transactionTags = getTransactionUniqueTags()
  const userTags = getUserUniqueTags()

  return [
    ...transactionTags.map((t) => ({
      tag: t.key,
      value: t.value,
      type: 'TRANSACTION' as const,
    })),
    ...userTags.map((u) => ({
      tag: u.key,
      value: u.value,
      type: 'USER' as const,
    })),
  ]
})

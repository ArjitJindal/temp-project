import memoize from 'lodash/memoize'
import { TRANSACTION_EVENTS_SEED } from '../data/seeds'
import { getTransactions } from './transactions'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'

const rng = new RandomNumberGenerator(TRANSACTION_EVENTS_SEED)

const eventId = rng.randomGuid()

const data: () => TransactionEventWithRulesResult[] = memoize(() => {
  return getTransactions().flatMap((t): TransactionEventWithRulesResult[] => {
    rng.setSeed(rng.getSeed() + 1)
    return [
      {
        transactionState: 'CREATED',
        timestamp: t.timestamp,
        transactionId: t.transactionId,
        eventId: eventId,
        reason: undefined,
        eventDescription: undefined,
        hitRules: t.hitRules,
        executedRules: t.executedRules,
        metaData: undefined,
        updatedTransactionAttributes: undefined,
        riskScoreDetails: {
          trsScore: rng.r(2).randomFloat(20),
          trsRiskLevel: 'LOW',
        },
      },
      {
        transactionState: 'SUSPENDED',
        timestamp: t.timestamp + 3600000,
        transactionId: t.transactionId,
        eventId: rng.r(1).randomGuid(),
        reason:
          'Some quite long reason here. It should take several lines to check work wrap',
        eventDescription:
          'Some quite long description here. It should take several lines to check work wrap',
        hitRules: t.hitRules,
        executedRules: t.executedRules,
        metaData: undefined,
        updatedTransactionAttributes: {
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'ABT',
          },
          originFundsInfo: {
            sourceOfFunds: 'GIFT',
          },
        },
        riskScoreDetails: {
          trsScore: rng.r(2).randomFloat(70),
          trsRiskLevel: 'VERY_HIGH',
        },
      },
      {
        transactionState: t.transactionState || 'REFUNDED',
        timestamp: t.timestamp + 3600000 + 3600000,
        transactionId: t.transactionId,
        eventId: rng.r(2).randomGuid(),
        reason: undefined,
        eventDescription: undefined,
        hitRules: t.hitRules,
        executedRules: t.executedRules,
        metaData: undefined,
        updatedTransactionAttributes: undefined,
        riskScoreDetails: {
          trsScore: rng.r(2).randomFloat(100),
          trsRiskLevel: 'HIGH',
        },
      },
    ]
  })
})

export { data }

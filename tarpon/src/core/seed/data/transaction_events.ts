import { memoize } from 'lodash'
import { TRANSACTION_EVENTS_SEED } from '../data/seeds'
import { getTransactions } from './transactions'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'

const rng = new RandomNumberGenerator(TRANSACTION_EVENTS_SEED)

const eventId = rng.randomGuid()

const data: () => InternalTransactionEvent[] = memoize(() => {
  return getTransactions().flatMap((t): InternalTransactionEvent[] => {
    rng.setSeed(rng.getSeed() + 1)
    return [
      {
        transactionState: 'CREATED',
        timestamp: t.timestamp,
        transactionId: t.transactionId,
        eventId: eventId,
        reason: undefined,
        eventDescription: undefined,
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

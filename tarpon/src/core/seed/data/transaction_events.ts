import { memoize } from 'lodash'
import { TRANSACTION_EVENTS_SEED } from '../data/seeds'
import { getTransactions } from './transactions'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'

const rng = new RandomNumberGenerator(TRANSACTION_EVENTS_SEED)

const eventId = rng.randomGuid()

const data: () => TransactionEvent[] = memoize(() => {
  return getTransactions().flatMap((t): TransactionEvent[] => {
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
        updatedTransactionAttributes: undefined,
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
      },
    ]
  })
})

export { data }

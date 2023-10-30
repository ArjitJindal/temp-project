import { memoize } from 'lodash'
import { getTransactions } from './transactions'
import { sampleGuid } from '@/core/seed/samplers/id'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

const eventId = sampleGuid()

const data: () => TransactionEvent[] = memoize(() => {
  return getTransactions().flatMap((t): TransactionEvent[] => {
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
        eventId: sampleGuid(),
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
        eventId: sampleGuid(),
        reason: undefined,
        eventDescription: undefined,
        metaData: undefined,
        updatedTransactionAttributes: undefined,
      },
    ]
  })
})

export { data }

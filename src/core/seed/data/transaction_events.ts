import { transactions } from './transactions'
import { sampleGuid } from '@/core/seed/samplers/id'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { prng } from '@/utils/prng'

const random = prng()
const eventId = sampleGuid(random())

let data: TransactionEvent[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  data = transactions.flatMap((t) => {
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
        eventId: sampleGuid(random()),
        reason:
          'Some quite long reason here. It should take several lines to check work wrap',
        eventDescription:
          'Some quite long description here. It should take several lines to check work wrap',
        metaData: undefined,
        updatedTransactionAttributes: undefined,
      },
      {
        transactionState: 'REFUNDED',
        timestamp: t.timestamp + 3600000 + 3600000,
        transactionId: t.transactionId,
        eventId: sampleGuid(random()),
        reason: undefined,
        eventDescription: undefined,
        metaData: undefined,
        updatedTransactionAttributes: undefined,
      },
    ]
  })
}

export { init, data }

import transactionsData from './transactions'
import { sampleGuid } from './samplers/id'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { prng } from '@/utils/prng'

const transaction = transactionsData[0]

const transactionId = transaction.transactionId as string
const timestamp = transaction.timestamp as number

const random = prng()
const eventId = sampleGuid(random())
const data: TransactionEvent[] = [
  {
    transactionState: 'CREATED',
    timestamp: timestamp,
    transactionId: transactionId,
    eventId: eventId,
    reason: undefined,
    eventDescription: undefined,
    metaData: undefined,
    updatedTransactionAttributes: undefined,
  },
  {
    transactionState: 'SUSPENDED',
    timestamp: timestamp + 3600000,
    transactionId: transactionId,
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
    timestamp: timestamp + 3600000 + 3600000,
    transactionId: transactionId,
    eventId: sampleGuid(random()),
    reason: undefined,
    eventDescription: undefined,
    metaData: undefined,
    updatedTransactionAttributes: undefined,
  },
]

export = data

import { TransactionEvent } from '../src/@types/openapi-public/TransactionEvent'

const data: TransactionEvent[] = [
  {
    transactionState: 'CREATED',
    timestamp: 1658834541713,
    transactionId: 'transaction-1',
    eventId: undefined,
    reason: undefined,
    eventDescription: undefined,
    employeeId: undefined,
    metaData: undefined,
    updatedTransactionAttributes: undefined,
  },
  {
    transactionState: 'SUSPENDED',
    timestamp: 1658834541713 + 3600000,
    transactionId: 'transaction-1',
    eventId: '62dfd4329004dd72acadb5a7',
    reason:
      'Some quite long reason here. It should take several lines to check work wrap',
    eventDescription:
      'Some quite long description here. It should take several lines to check work wrap',
    employeeId: undefined,
    metaData: undefined,
    updatedTransactionAttributes: undefined,
  },
  {
    transactionState: 'REFUNDED',
    timestamp: 1658834541713 + 3600000 + 3600000,
    transactionId: 'transaction-1',
    eventId: undefined,
    reason: undefined,
    eventDescription: undefined,
    employeeId: undefined,
    metaData: undefined,
    updatedTransactionAttributes: undefined,
  },
]

export = data

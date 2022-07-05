import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function getTestTransaction(
  transaction: Partial<Transaction> = {}
): Transaction {
  return {
    transactionId: uuidv4(),
    transactionState: 'SUCCESSFUL',
    originUserId: '8650a2611d0771cba03310f74bf6',
    destinationUserId: '9350a2611e0771cba03310f74bf6',
    originAmountDetails: {
      country: 'DE',
      transactionAmount: 800,
      transactionCurrency: 'EUR',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    timestamp: dayjs().valueOf(),
    originPaymentDetails: {
      method: 'CARD',
      cardFingerprint: uuidv4(),
      cardIssuedCountry: 'US',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: uuidv4(),
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    ...transaction,
  }
}

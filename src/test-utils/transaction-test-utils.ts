import _ from 'lodash'
import dayjs from 'dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function getTestTransaction(
  transaction: Partial<Transaction> = {}
): Transaction {
  return {
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
    timestamp: dayjs().unix(),
    originPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'US',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    ...transaction,
  }
}

import _ from 'lodash'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function getTestTransaction(
  transaction: Partial<Transaction>
): Transaction {
  return {
    transactionId: '7b80a539eea6e78acbd6d458e5971482',
    senderUserId: '8650a2611d0771cba03310f74bf6',
    receiverUserId: '9350a2611e0771cba03310f74bf6',
    sendingAmountDetails: {
      country: 'DE',
      transactionAmount: 800,
      transactionCurrency: 'EUR',
    },
    receivingAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    timestamp: 1641654664,
    senderPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'US',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    receiverPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'Deposit',
      _3dsDone: true,
    },
    ..._.omitBy(transaction, _.isNil),
  }
}

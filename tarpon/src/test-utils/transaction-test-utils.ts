import { v4 as uuidv4 } from 'uuid'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export function getTestTransaction(
  transaction: Partial<Transaction | InternalTransaction> = {}
): Transaction {
  return {
    type: 'TRANSFER',
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
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: uuidv4(),
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    ...transaction,
  }
}

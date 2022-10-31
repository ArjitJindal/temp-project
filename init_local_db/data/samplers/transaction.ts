import { sampleTimestamp } from './timestamp'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { randomInt } from '@/utils/prng'

export function sampleTransaction(seed?: number): TransactionCaseManagement {
  return {
    transactionId: `sample_transaction_${randomInt(seed)}`,
    type: 'TRANSFER',
    destinationAmountDetails: {
      country: 'PH',
      transactionCurrency: 'PHP',
      transactionAmount: 50,
    },
    productType: 'Payment link',
    transactionState: 'CREATED' as const,
    originAmountDetails: {
      country: 'PH' as const,
      transactionCurrency: 'PHP' as const,
      transactionAmount: 50,
    },
    timestamp: sampleTimestamp(seed),
    destinationPaymentDetails: {
      method: 'WALLET' as const,
      walletType: 'internal' as const,
      paymentChannel: 'nextpay',
    },
    originPaymentDetails: {
      method: 'CARD' as const,
    },
    hitRules: [],
    executedRules: [],
    status: 'ALLOW' as const,
  }
}

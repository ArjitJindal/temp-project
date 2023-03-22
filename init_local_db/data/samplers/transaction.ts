import { sampleTimestamp } from './timestamp'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { randomInt } from '@/utils/prng'

export function sampleTransaction(seed?: number): InternalTransaction {
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

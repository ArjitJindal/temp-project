import _ from 'lodash'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

export function isTransactionAmountAboveThreshold(
  transactionAmountDefails: TransactionAmountDetails,
  thresholds: {
    [currency: string]: number
  }
) {
  return isTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    _.mapValues(thresholds, (threshold) => ({
      min: threshold,
    }))
  )
}

export function isTransactionAmountBelowThreshold(
  transactionAmountDefails: TransactionAmountDetails,
  thresholds: {
    [currency: string]: number
  }
) {
  return isTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    _.mapValues(thresholds, (threshold) => ({
      max: threshold,
    }))
  )
}

export async function isTransactionAmountBetweenThreshold(
  transactionAmountDefails: TransactionAmountDetails,
  thresholds: {
    [currency: string]: {
      min?: number
      max?: number
    }
  }
): Promise<boolean> {
  const convertedTransactionAmount = thresholds[
    transactionAmountDefails.transactionCurrency
  ]
    ? transactionAmountDefails
    : await getTargetCurrencyAmount(
        transactionAmountDefails,
        Object.keys(thresholds)[0]
      )
  const { min, max } =
    thresholds[convertedTransactionAmount.transactionCurrency]
  return _.inRange(
    convertedTransactionAmount.transactionAmount,
    min || -Infinity,
    max || Infinity
  )
}

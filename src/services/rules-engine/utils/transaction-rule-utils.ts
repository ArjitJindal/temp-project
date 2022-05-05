import * as _ from 'lodash'
import dayjs from 'dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'

export async function isTransactionAmountAboveThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
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

export async function isTransactionAmountBelowThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
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
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: {
      min?: number
      max?: number
    }
  }
): Promise<boolean> {
  if (!transactionAmountDefails) {
    return false
  }

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

export function isTransactionWithinTimeWindow(
  transaction: Transaction,
  timeWindow:
    | {
        from: string // format: 00:00:00+00:00
        to: string
      }
    | undefined
) {
  if (!timeWindow) {
    return true
  }
  const transactionTime = dayjs(transaction.timestamp)
  const transactionDateString = transactionTime.format('YYYY-MM-DD')
  const fromTime = dayjs(`${transactionDateString}T${timeWindow.from}`)
  const toTime = dayjs(`${transactionDateString}T${timeWindow.to}`)
  return fromTime <= transactionTime && toTime >= transactionTime
}

export async function getTransactionsTotalAmount(
  amountDetailsList: (TransactionAmountDetails | undefined)[],
  targetCurrency: string
): Promise<TransactionAmountDetails> {
  let totalAmount: TransactionAmountDetails = {
    transactionAmount: 0,
    transactionCurrency: targetCurrency,
  }
  for (const amountDetails of amountDetailsList) {
    if (amountDetails) {
      const targetAmount = await getTargetCurrencyAmount(
        amountDetails,
        targetCurrency
      )
      totalAmount = {
        transactionAmount:
          totalAmount.transactionAmount + targetAmount.transactionAmount,
        transactionCurrency: targetCurrency,
      }
    }
  }
  return totalAmount
}

export function sumTransactionAmountDetails(
  transactionAmountDetails1: TransactionAmountDetails,
  transactionAmountDetails2: TransactionAmountDetails
): TransactionAmountDetails {
  if (
    transactionAmountDetails1.transactionCurrency !==
    transactionAmountDetails2.transactionCurrency
  ) {
    throw new Error('Currencies should be the same for summing up.')
  }
  return {
    transactionAmount:
      transactionAmountDetails1.transactionAmount +
      transactionAmountDetails2.transactionAmount,
    transactionCurrency: transactionAmountDetails1.transactionCurrency,
  }
}

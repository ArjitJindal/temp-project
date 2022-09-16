import * as _ from 'lodash'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { TimeWindow } from '../rule'
import { subtractTime } from './time-utils'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export function isTransactionInTargetTypes(
  transactionType: TransactionType | undefined,
  targetTypes: TransactionType[] | undefined
) {
  return (
    !targetTypes || targetTypes.includes(transactionType as TransactionType)
  )
}

export async function isTransactionAmountAboveThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: number
  }
): Promise<boolean> {
  const result = await checkTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    _.mapValues(thresholds, (threshold) => ({
      min: threshold,
    }))
  )
  return result != null
}

export async function isTransactionAmountBelowThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: number
  }
): Promise<boolean> {
  const result = await checkTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    _.mapValues(thresholds, (threshold) => ({
      max: threshold,
    }))
  )
  return result != null
}

type ThresholdHit = { currency: string; min?: number; max?: number }

export async function checkTransactionAmountBetweenThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: {
      min?: number
      max?: number
    }
  }
): Promise<ThresholdHit | null> {
  if (!transactionAmountDefails || Object.keys(thresholds).length === 0) {
    return null
  }

  const transactionCurrency = transactionAmountDefails.transactionCurrency
  const convertedTransactionAmount = thresholds[transactionCurrency]
    ? transactionAmountDefails
    : await getTargetCurrencyAmount(
        transactionAmountDefails,
        Object.keys(thresholds)[0]
      )
  const { min, max } =
    thresholds[convertedTransactionAmount.transactionCurrency]
  if (
    _.inRange(
      convertedTransactionAmount.transactionAmount,
      min || -Infinity,
      max || Infinity
    )
  ) {
    return { currency: transactionCurrency, min, max }
  }
  return null
}

export function isTransactionWithinTimeWindow(
  transaction: Transaction,
  timeWindow:
    | {
        from?: string // format: 00:00:00+00:00
        to?: string
      }
    | undefined
) {
  if (!timeWindow || !timeWindow.from || !timeWindow.to) {
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

async function getTransactions(
  userId: string | undefined,
  paymentDetails: PaymentDetails | undefined,
  transactionRepository: TransactionRepository,
  options: {
    afterTimestamp: number
    beforeTimestamp: number
    checkType: 'sending' | 'receiving' | 'all' | 'none'
    transactionState?: TransactionState
    transactionTypes?: TransactionType[]
  }
): Promise<{
  sendingTransactions: ThinTransaction[]
  receivingTransactions: ThinTransaction[]
}> {
  const {
    checkType,
    beforeTimestamp,
    afterTimestamp,
    transactionState,
    transactionTypes,
  } = options
  const [sendingTransactions, receivingTransactions] = await Promise.all([
    checkType === 'sending' || checkType === 'all'
      ? transactionRepository.getGenericUserSendingThinTransactions(
          userId,
          paymentDetails,
          {
            afterTimestamp,
            beforeTimestamp,
          },
          {
            transactionState,
            transactionTypes,
          }
        )
      : Promise.resolve([]),
    checkType === 'receiving' || checkType === 'all'
      ? transactionRepository.getGenericUserReceivingThinTransactions(
          userId,
          paymentDetails,
          {
            afterTimestamp,
            beforeTimestamp,
          },
          {
            transactionState,
            transactionTypes,
          }
        )
      : Promise.resolve([]),
  ])
  return {
    sendingTransactions,
    receivingTransactions,
  }
}

export async function getTransactionUserPastTransactions(
  transaction: Transaction,
  transactionRepository: TransactionRepository,
  options: {
    timeWindow: TimeWindow
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
    transactionState?: TransactionState
    transactionTypes?: TransactionType[]
  }
): Promise<{
  senderSendingTransactions: Transaction[]
  senderReceivingTransactions: Transaction[]
  receiverSendingTransactions: Transaction[]
  receiverReceivingTransactions: Transaction[]
}> {
  const {
    checkSender,
    checkReceiver,
    timeWindow,
    transactionState,
    transactionTypes,
  } = options
  const afterTimestamp = subtractTime(dayjs(transaction.timestamp), timeWindow)
  const beforeTimestamp = transaction.timestamp!
  const senderTransactionsPromise =
    checkSender !== 'none'
      ? getTransactions(
          transaction.originUserId,
          transaction.originPaymentDetails,
          transactionRepository,
          {
            afterTimestamp,
            beforeTimestamp,
            checkType: checkSender,
            transactionState,
            transactionTypes,
          }
        )
      : Promise.resolve({
          sendingTransactions: [],
          receivingTransactions: [],
        })
  const receiverTransactionsPromise =
    checkReceiver !== 'none'
      ? getTransactions(
          transaction.destinationUserId,
          transaction.destinationPaymentDetails,
          transactionRepository,
          {
            afterTimestamp,
            beforeTimestamp,
            checkType: checkReceiver,
            transactionState,
            transactionTypes,
          }
        )
      : Promise.resolve({
          sendingTransactions: [],
          receivingTransactions: [],
        })
  const [senderThinTransactions, receiverThinTransactions] = await Promise.all([
    senderTransactionsPromise,
    receiverTransactionsPromise,
  ])
  const [
    senderSendingTransactions,
    senderReceivingTransactions,
    receiverSendingTransactions,
    receiverReceivingTransactions,
  ] = await Promise.all([
    transactionRepository.getTransactionsByIds(
      senderThinTransactions.sendingTransactions.map(
        (transaction) => transaction.transactionId
      )
    ),
    transactionRepository.getTransactionsByIds(
      senderThinTransactions.receivingTransactions.map(
        (transaction) => transaction.transactionId
      )
    ),
    transactionRepository.getTransactionsByIds(
      receiverThinTransactions.sendingTransactions.map(
        (transaction) => transaction.transactionId
      )
    ),
    transactionRepository.getTransactionsByIds(
      receiverThinTransactions.receivingTransactions.map(
        (transaction) => transaction.transactionId
      )
    ),
  ])
  return {
    senderSendingTransactions,
    senderReceivingTransactions,
    receiverSendingTransactions,
    receiverReceivingTransactions,
  }
}

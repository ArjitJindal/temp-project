import * as _ from 'lodash'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { getTimestampRange } from './time-utils'
import { TimeWindow } from './rule-parameter-schemas'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export async function isTransactionAmountAboveThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: number
  }
): Promise<{ thresholdHit: ThresholdHit | null; isHit: boolean }> {
  const result = await checkTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    _.mapValues(thresholds, (threshold) => ({
      min: threshold,
    }))
  )
  return { thresholdHit: result, isHit: result != null }
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
        Object.keys(thresholds)[0] as CurrencyCode
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

export async function getTransactionsTotalAmount(
  amountDetailsList: (TransactionAmountDetails | undefined)[],
  targetCurrency: CurrencyCode
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
    paymentMethod?: PaymentMethod
    matchPaymentMethodDetails?: boolean
    countries?: string[]
  },
  attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
): Promise<{
  sendingTransactions: AuxiliaryIndexTransaction[]
  receivingTransactions: AuxiliaryIndexTransaction[]
}> {
  const {
    checkType,
    beforeTimestamp,
    afterTimestamp,
    transactionState,
    transactionTypes,
    paymentMethod,
    matchPaymentMethodDetails,
    countries,
  } = options
  const [sendingTransactions, receivingTransactions] = await Promise.all([
    checkType === 'sending' || checkType === 'all'
      ? transactionRepository.getGenericUserSendingTransactions(
          userId,
          paymentDetails,
          {
            afterTimestamp,
            beforeTimestamp,
          },
          {
            transactionState,
            transactionTypes,
            originPaymentMethod: paymentMethod,
            originCountries: countries,
          },
          attributesToFetch,
          matchPaymentMethodDetails
        )
      : Promise.resolve([]),
    checkType === 'receiving' || checkType === 'all'
      ? transactionRepository.getGenericUserReceivingTransactions(
          userId,
          paymentDetails,
          {
            afterTimestamp,
            beforeTimestamp,
          },
          {
            transactionState,
            transactionTypes,
            destinationPaymentMethod: paymentMethod,
            destinationCountries: countries,
          },
          attributesToFetch,
          matchPaymentMethodDetails
        )
      : Promise.resolve([]),
  ])
  return {
    sendingTransactions,
    receivingTransactions,
  }
}

async function getTransactionsCount(
  userId: string | undefined,
  paymentDetails: PaymentDetails | undefined,
  transactionRepository: TransactionRepository,
  options: {
    afterTimestamp: number
    beforeTimestamp: number
    checkType: 'sending' | 'receiving' | 'all' | 'none'
    transactionState?: TransactionState
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
  }
): Promise<{
  sendingTransactionsCount: number | null
  receivingTransactionsCount: number | null
}> {
  const {
    checkType,
    beforeTimestamp,
    afterTimestamp,
    transactionState,
    transactionTypes,
    paymentMethod,
  } = options
  const [sendingTransactionsCount, receivingTransactionsCount] =
    await Promise.all([
      checkType === 'sending' || checkType === 'all'
        ? transactionRepository.getGenericUserSendingTransactionsCount(
            userId,
            paymentDetails,
            {
              afterTimestamp,
              beforeTimestamp,
            },
            {
              transactionState,
              transactionTypes,
              originPaymentMethod: paymentMethod,
            }
          )
        : Promise.resolve(null),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getGenericUserReceivingTransactionsCount(
            userId,
            paymentDetails,
            {
              afterTimestamp,
              beforeTimestamp,
            },
            {
              transactionState,
              transactionTypes,
              destinationPaymentMethod: paymentMethod,
            }
          )
        : Promise.resolve(null),
    ])
  return {
    sendingTransactionsCount,
    receivingTransactionsCount,
  }
}

export async function getTransactionUserPastTransactions(
  transaction: Transaction,
  transactionRepository: TransactionRepository,
  options: {
    timeWindow: TimeWindow
    checkSender: 'sending' | 'receiving' | 'all' | 'none'
    checkReceiver: 'sending' | 'receiving' | 'all' | 'none'
    transactionState?: TransactionState
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    matchPaymentMethodDetails?: boolean
    countries?: string[]
  },
  attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
): Promise<{
  senderSendingTransactions: AuxiliaryIndexTransaction[]
  senderReceivingTransactions: AuxiliaryIndexTransaction[]
  receiverSendingTransactions: AuxiliaryIndexTransaction[]
  receiverReceivingTransactions: AuxiliaryIndexTransaction[]
}> {
  const {
    checkSender,
    checkReceiver,
    timeWindow,
    transactionState,
    transactionTypes,
    paymentMethod,
    matchPaymentMethodDetails,
    countries,
  } = options
  const { afterTimestamp, beforeTimestamp } = getTimestampRange(
    transaction.timestamp!,
    timeWindow
  )
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
            paymentMethod,
            matchPaymentMethodDetails,
            countries,
          },
          attributesToFetch
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
            paymentMethod,
            matchPaymentMethodDetails,
            countries,
          },
          attributesToFetch
        )
      : Promise.resolve({
          sendingTransactions: [],
          receivingTransactions: [],
        })
  const [senderTransactions, receiverTransactions] = await Promise.all([
    senderTransactionsPromise,
    receiverTransactionsPromise,
  ])
  return {
    senderSendingTransactions: senderTransactions.sendingTransactions,
    senderReceivingTransactions: senderTransactions.receivingTransactions,
    receiverSendingTransactions: receiverTransactions.sendingTransactions,
    receiverReceivingTransactions: receiverTransactions.receivingTransactions,
  }
}

export async function getTransactionUserPastTransactionsCount(
  transaction: Transaction,
  transactionRepository: TransactionRepository,
  options: {
    timeWindow: TimeWindow
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
    transactionState?: TransactionState
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    country?: string[]
  }
): Promise<{
  senderSendingTransactionsCount: number | null
  senderReceivingTransactionsCount: number | null
  receiverSendingTransactionsCount: number | null
  receiverReceivingTransactionsCount: number | null
}> {
  const {
    checkSender,
    checkReceiver,
    timeWindow,
    transactionState,
    transactionTypes,
    paymentMethod,
  } = options
  const { afterTimestamp, beforeTimestamp } = getTimestampRange(
    transaction.timestamp!,
    timeWindow
  )
  const senderTransactionsCountPromise =
    checkSender !== 'none'
      ? getTransactionsCount(
          transaction.originUserId,
          transaction.originPaymentDetails,
          transactionRepository,
          {
            afterTimestamp,
            beforeTimestamp,
            checkType: checkSender,
            transactionState,
            transactionTypes,
            paymentMethod,
          }
        )
      : Promise.resolve({
          sendingTransactionsCount: null,
          receivingTransactionsCount: null,
        })
  const receiverTransactionsCountPromise =
    checkReceiver !== 'none'
      ? getTransactionsCount(
          transaction.destinationUserId,
          transaction.destinationPaymentDetails,
          transactionRepository,
          {
            afterTimestamp,
            beforeTimestamp,
            checkType: checkReceiver,
            transactionState,
            transactionTypes,
            paymentMethod,
          }
        )
      : Promise.resolve({
          sendingTransactionsCount: null,
          receivingTransactionsCount: null,
        })
  const [senderTransactionsCount, receiverTransactionsCount] =
    await Promise.all([
      senderTransactionsCountPromise,
      receiverTransactionsCountPromise,
    ])

  return {
    senderSendingTransactionsCount:
      senderTransactionsCount.sendingTransactionsCount,
    senderReceivingTransactionsCount:
      senderTransactionsCount.receivingTransactionsCount,
    receiverSendingTransactionsCount:
      receiverTransactionsCount.sendingTransactionsCount,
    receiverReceivingTransactionsCount:
      receiverTransactionsCount.receivingTransactionsCount,
  }
}

export async function groupTransactionsByHour<T>(
  transactions: AuxiliaryIndexTransaction[],
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>
): Promise<{ [hourKey: string]: T }> {
  const groups = _.groupBy(transactions, (transaction) =>
    dayjs(transaction.timestamp).format('YYYYMMDDHH')
  )
  const newGroups: { [key: string]: T } = {}
  for (const group in groups) {
    newGroups[group] = await aggregator(groups[group])
  }
  return newGroups
}

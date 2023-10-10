import { groupBy, inRange, mapValues } from 'lodash'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
} from '../repositories/transaction-repository-interface'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from './time-utils'
import { TimeWindow } from './rule-parameter-schemas'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export async function isTransactionAmountAboveThreshold(
  transactionAmountDefails: TransactionAmountDetails | undefined,
  thresholds: {
    [currency: string]: number
  }
): Promise<{ thresholdHit: ThresholdHit | null; isHit: boolean }> {
  const result = await checkTransactionAmountBetweenThreshold(
    transactionAmountDefails,
    mapValues(thresholds, (threshold) => ({
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
    mapValues(thresholds, (threshold) => ({
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
    inRange(
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
  transactionRepository: RulesEngineTransactionRepositoryInterface,
  options: {
    afterTimestamp: number
    beforeTimestamp: number
    checkType: 'sending' | 'receiving' | 'all' | 'none'
    matchPaymentMethodDetails?: boolean
    filters: TransactionHistoricalFilters
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
    matchPaymentMethodDetails,
    filters,
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
            transactionStates: filters.transactionStatesHistorical,
            transactionTypes: filters.transactionTypesHistorical,
            transactionAmountRange: filters.transactionAmountRangeHistorical,
            originPaymentMethods: filters.paymentMethodsHistorical,
            originCountries: filters.transactionCountriesHistorical,
            transactionTimeRange: filters.transactionTimeRangeHistorical,
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
            transactionStates: filters.transactionStatesHistorical,
            transactionTypes: filters.transactionTypesHistorical,
            transactionAmountRange: filters.transactionAmountRangeHistorical,
            destinationPaymentMethods: filters.paymentMethodsHistorical,
            destinationCountries: filters.transactionCountriesHistorical,
            transactionTimeRange: filters.transactionTimeRangeHistorical,
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

export async function getTransactionUserPastTransactionsByDirection(
  transaction: Transaction,
  direction: 'origin' | 'destination',
  transactionRepository: RulesEngineTransactionRepositoryInterface,
  options: {
    timeWindow: TimeWindow
    checkDirection: 'sending' | 'receiving' | 'all' | 'none'
    matchPaymentMethodDetails?: boolean
    filters: TransactionHistoricalFilters
  },
  attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
): Promise<{
  sendingTransactions: AuxiliaryIndexTransaction[]
  receivingTransactions: AuxiliaryIndexTransaction[]
}> {
  const {
    senderSendingTransactions,
    senderReceivingTransactions,
    receiverSendingTransactions,
    receiverReceivingTransactions,
  } = await getTransactionUserPastTransactions(
    transaction,
    transactionRepository,
    {
      ...options,
      checkSender: direction === 'origin' ? options.checkDirection : 'none',
      checkReceiver:
        direction === 'destination' ? options.checkDirection : 'none',
    },
    attributesToFetch
  )
  return {
    sendingTransactions:
      direction === 'origin'
        ? senderSendingTransactions
        : receiverSendingTransactions,
    receivingTransactions:
      direction === 'origin'
        ? senderReceivingTransactions
        : receiverReceivingTransactions,
  }
}

export async function getTransactionUserPastTransactions(
  transaction: Transaction,
  transactionRepository: RulesEngineTransactionRepositoryInterface,
  options: {
    timeWindow: TimeWindow
    checkSender: 'sending' | 'receiving' | 'all' | 'none'
    checkReceiver: 'sending' | 'receiving' | 'all' | 'none'
    matchPaymentMethodDetails?: boolean
    filters: TransactionHistoricalFilters
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
    matchPaymentMethodDetails,
    filters,
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
            matchPaymentMethodDetails,
            filters,
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
            matchPaymentMethodDetails,
            filters,
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

export async function groupTransactionsByHour<T>(
  transactions: AuxiliaryIndexTransaction[],
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>
): Promise<{ [hourKey: string]: T }> {
  return groupTransactions(
    transactions,
    (transaction) => dayjs(transaction.timestamp).format('YYYYMMDDHH'),
    aggregator
  )
}

export async function groupTransactions<T>(
  transactions: AuxiliaryIndexTransaction[],
  iteratee: (transactions: AuxiliaryIndexTransaction) => string,
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>
): Promise<{ [hourKey: string]: T }> {
  const groups = groupBy(transactions, iteratee)
  const newGroups: { [key: string]: T } = {}
  for (const group in groups) {
    newGroups[group] = await aggregator(groups[group])
  }
  return newGroups
}

import { MINUTE_GROUP_SIZE } from '@flagright/lib/constants'
import { groupBy, inRange, last, mapValues } from 'lodash'
import memoizeOne from 'memoize-one'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
  TransactionWithRiskDetails,
} from '../repositories/transaction-repository-interface'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from './time-utils'
import { TimeWindow } from './rule-parameter-schemas'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { zipGenerators, staticValueGenerator } from '@/utils/generator'
import { CurrencyService } from '@/services/currency'
import { RuleAggregationTimeWindowGranularity } from '@/@types/openapi-internal/RuleAggregationTimeWindowGranularity'
import { mergeEntities } from '@/utils/object'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'

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

  const currencyService = new CurrencyService()

  const transactionCurrency = transactionAmountDefails.transactionCurrency
  const convertedTransactionAmount = thresholds[transactionCurrency]
    ? transactionAmountDefails
    : await currencyService.getTargetCurrencyAmount(
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

  const currencyService = new CurrencyService()

  for (const amountDetails of amountDetailsList) {
    if (amountDetails) {
      const targetAmount = await currencyService.getTargetCurrencyAmount(
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

export async function* getTransactionsGenerator(
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
): AsyncGenerator<{
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
  const sendingTransactionsGenerator =
    checkType === 'sending' || checkType === 'all'
      ? transactionRepository.getGenericUserSendingTransactionsGenerator(
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
            transactionTimeRange24hr:
              filters.transactionTimeRangeHistorical24hr,
          },
          attributesToFetch,
          matchPaymentMethodDetails
        )
      : staticValueGenerator<Array<AuxiliaryIndexTransaction>>([])
  const receivingTransactionsGenerator =
    checkType === 'receiving' || checkType === 'all'
      ? transactionRepository.getGenericUserReceivingTransactionsGenerator(
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
            transactionTimeRange24hr:
              filters.transactionTimeRangeHistorical24hr,
          },
          attributesToFetch,
          matchPaymentMethodDetails
        )
      : staticValueGenerator<Array<AuxiliaryIndexTransaction>>([])

  for await (const data of zipGenerators(
    sendingTransactionsGenerator,
    receivingTransactionsGenerator,
    []
  )) {
    yield {
      sendingTransactions: data[0],
      receivingTransactions: data[1],
    }
  }
}

export async function* getTransactionUserPastTransactionsByDirectionGenerator(
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
): AsyncGenerator<{
  sendingTransactions: AuxiliaryIndexTransaction[]
  receivingTransactions: AuxiliaryIndexTransaction[]
}> {
  const generator = getTransactionUserPastTransactionsGenerator(
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

  for await (const result of generator) {
    yield {
      sendingTransactions:
        direction === 'origin'
          ? result.senderSendingTransactions
          : result.receiverSendingTransactions,
      receivingTransactions:
        direction === 'origin'
          ? result.senderReceivingTransactions
          : result.receiverReceivingTransactions,
    }
  }
}

export async function* getTransactionUserPastTransactionsGenerator(
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
): AsyncGenerator<{
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
    transaction.timestamp,
    timeWindow
  )
  const senderTransactionsGenerator =
    checkSender !== 'none'
      ? getTransactionsGenerator(
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
      : staticValueGenerator({
          sendingTransactions: [],
          receivingTransactions: [],
        })
  const receiverTransactionsGenerator =
    checkReceiver !== 'none'
      ? getTransactionsGenerator(
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
      : staticValueGenerator({
          sendingTransactions: [],
          receivingTransactions: [],
        })

  for await (const data of zipGenerators(
    senderTransactionsGenerator,
    receiverTransactionsGenerator,
    { sendingTransactions: [], receivingTransactions: [] }
  )) {
    yield {
      senderSendingTransactions: data[0].sendingTransactions,
      senderReceivingTransactions: data[0].receivingTransactions,
      receiverSendingTransactions: data[1].sendingTransactions,
      receiverReceivingTransactions: data[1].receivingTransactions,
    }
  }
}

export async function groupTransactionsByGranularity<T>(
  transactions: AuxiliaryIndexTransaction[],
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>,
  granularity: RuleAggregationTimeWindowGranularity
): Promise<{ [timeKey: string]: T }> {
  return groupTransactions(
    transactions,
    (transaction) =>
      getTransactionStatsTimeGroupLabel(
        transaction.timestamp ?? 0,
        granularity
      ),
    aggregator
  )
}

export async function groupTransactionsByTime<T>(
  transactions: AuxiliaryIndexTransaction[],
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>,
  timeGranularity: RuleAggregationTimeWindowGranularity
): Promise<{ [hourKey: string]: T }> {
  return groupTransactions(
    transactions,
    (transaction) =>
      getTransactionStatsTimeGroupLabelV2(
        transaction.timestamp as number,
        timeGranularity
      ),
    aggregator
  )
}

export async function groupTransactions<T>(
  transactions: AuxiliaryIndexTransaction[],
  iteratee: (transactions: AuxiliaryIndexTransaction) => string,
  aggregator: (transactions: AuxiliaryIndexTransaction[]) => Promise<T>
): Promise<{ [timeKey: string]: T }> {
  const groups = groupBy(transactions, iteratee)
  const newGroups: { [key: string]: T } = {}
  for (const group in groups) {
    newGroups[group] = await aggregator(groups[group])
  }
  return newGroups
}

// TODO: We use UTC time for getting the time label for now. We could use
// the customer specified timezone if there's a need.

export function getTransactionStatsTimeGroupLabel(
  timestamp: number,
  timeGranularity: RuleAggregationTimeWindowGranularity
): string {
  switch (timeGranularity) {
    case 'minute': {
      const date = dayjs(timestamp)
      const minuteGroup = Math.floor(date.minute() / MINUTE_GROUP_SIZE)
      return dayjs(timestamp).format('YYYY-MM-DD-HH') + `-${minuteGroup}`
    }
    case 'day':
      return dayjs(timestamp).format('YYYY-MM-DD')
    case 'week': {
      const time = dayjs(timestamp)
      return `${time.format('YYYY')}-W${time.week()}`
    }
    case 'month':
      return dayjs(timestamp).format('YYYY-MM')
    case 'year':
      return dayjs(timestamp).format('YYYY')
    default:
      return dayjs(timestamp).format('YYYY-MM-DD-HH')
  }
}

export function getTransactionStatsTimeGroupLabelV2(
  timestamp: number,
  timeGranularity: RuleAggregationTimeWindowGranularity
): string {
  if (timeGranularity === 'hour') {
    // For backward compatibility
    return dayjs(timestamp).format('YYYYMMDDHH')
  }
  return getTransactionStatsTimeGroupLabel(timestamp, timeGranularity)
}

const NAME_PREFIXES = [
  'Mr',
  'Mrs',
  'Miss',
  'Ms',
  'Dr',
  'Sr',
  'Sra',
  'Srta',
  'Dr',
  'M',
  'Mme',
  'Mlle',
  'Dr',
  'Herr',
  'Frau',
  'Fräulein',
  'Dr',
  'Sr',
  'Sra',
  'Srta',
  'Dr',
]

export function removePrefixFromName(
  name: string,
  toLowerCase: boolean = false
): string {
  NAME_PREFIXES.forEach((prefix) => {
    name = name?.replace(new RegExp(`^${prefix}\\.? `, 'gi'), '')
  })
  if (toLowerCase) {
    name = name.toLowerCase()
  }
  return name
}

export const hydrateTransactionEvents = memoizeOne(
  // NOTE: transactionEvents should already be sorted by timestamp (1st to last)
  (
    transactionEvents: TransactionEventWithRulesResult[]
  ): Array<{
    transactionEvent: TransactionEventWithRulesResult
    transaction: TransactionWithRiskDetails
  }> => {
    const hydratedTransactionEvents: Array<{
      transactionEvent: TransactionEventWithRulesResult
      transaction: TransactionWithRiskDetails
    }> = []
    for (const transactionEvent of transactionEvents) {
      const prevTransactionEvent = last(hydratedTransactionEvents)
      hydratedTransactionEvents.push({
        transactionEvent,
        transaction: {
          ...mergeEntities(
            prevTransactionEvent?.transaction ?? {},
            transactionEvent.updatedTransactionAttributes ?? {}
          ),
          transactionState: transactionEvent.transactionState,
          riskScoreDetails: transactionEvent.riskScoreDetails,
        } as TransactionWithRiskDetails,
      })
    }
    return hydratedTransactionEvents
  }
)

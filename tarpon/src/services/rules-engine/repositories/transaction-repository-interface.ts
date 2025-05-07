import {
  TransactionAmountRange,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'

export type TransactionWithRiskDetails = Omit<
  TransactionWithRulesResult,
  'executedRules' | 'hitRules' | 'status'
>

export type AuxiliaryIndexTransaction = Partial<TransactionWithRiskDetails> & {
  senderKeyId?: string
  receiverKeyId?: string
}

export type TimeRange = {
  beforeTimestamp: number // exclusive
  afterTimestamp: number // inclusive
}

export type TransactionsFilterOptions = {
  transactionTypes?: string[]
  transactionStates?: TransactionState[]
  originPaymentMethods?: PaymentMethod[]
  destinationPaymentMethods?: PaymentMethod[]
  originCountries?: string[]
  destinationCountries?: string[]
  transactionAmountRange?: TransactionAmountRange
  transactionTimeRange24hr?: TransactionTimeRange
}

export interface RulesEngineTransactionRepositoryInterface {
  getLastNUserSendingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>>

  getLastNUserReceivingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>>

  getGenericUserSendingTransactionsGenerator(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>>

  getGenericUserReceivingTransactionsGenerator(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>>

  getUserSendingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>>

  getUserReceivingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>>

  getGenericUserSendingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  getGenericUserReceivingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  getUserSendingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  getNonUserSendingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  getNonUserReceivingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number>

  hasAnySendingTransaction(
    userId: string,
    filterOptions: TransactionsFilterOptions
  ): Promise<boolean>

  getIpAddressTransactions(
    ipAddress: string,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>>
}

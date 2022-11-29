import { TransactionRuleFilter } from './filter'
import {
  PaymentMethodRuleFilter,
  PaymentMethodRuleFilterParameter,
} from './payment-method'
import {
  TransactionTypeRuleFilter,
  TransactionTypeRuleFilterParameter,
} from './transaction-type'
import {
  TransactionStateRuleFilter,
  TransactionStateRuleFilterParameter,
} from './transaction-state'
import {
  CountryRuleFilter,
  CountryRuleFilterParameter,
} from './transaction-country'
import {
  CheckDirectionRuleFilter,
  CheckDirectionRuleFilterParameter,
} from './check-direction'

export type TransactionFilterKeys =
  | keyof PaymentMethodRuleFilterParameter
  | keyof TransactionTypeRuleFilterParameter
  | keyof TransactionStateRuleFilterParameter
  | keyof CountryRuleFilterParameter
  | keyof CheckDirectionRuleFilterParameter
export type TransactionFilters = PaymentMethodRuleFilterParameter &
  TransactionTypeRuleFilterParameter &
  TransactionStateRuleFilterParameter &
  CountryRuleFilterParameter &
  CheckDirectionRuleFilterParameter

const _TRANSACTION_FILTERS = new Map<TransactionFilterKeys, any>([
  ['paymentMethod', PaymentMethodRuleFilter],
  ['transactionTypes', TransactionTypeRuleFilter],
  ['transactionState', TransactionStateRuleFilter],
  ['transactionCountries', CountryRuleFilter],
  ['checkDirection', CheckDirectionRuleFilter],
])

export const TRANSACTION_FILTERS = Object.fromEntries(_TRANSACTION_FILTERS) as {
  [key: string]: typeof TransactionRuleFilter
}

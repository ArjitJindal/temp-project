import { TransactionRuleFilter } from './filter'
import PaymentMethodRuleFilter, {
  PaymentMethodRuleFilterParameter,
} from './payment-method'
import TransactionTypeRuleFilter, {
  TransactionTypeRuleFilterParameter,
} from './transaction-type'
import TransactionStateRuleFilter, {
  TransactionStateRuleFilterParameter,
} from './transaction-state'

export type TransactionFilterKeys =
  | keyof PaymentMethodRuleFilterParameter
  | keyof TransactionTypeRuleFilterParameter
  | keyof TransactionStateRuleFilterParameter
export type TransactionFilters = PaymentMethodRuleFilterParameter &
  TransactionTypeRuleFilterParameter &
  TransactionStateRuleFilterParameter

const _TRANSACTION_FILTERS = new Map<TransactionFilterKeys, any>([
  ['paymentMethod', PaymentMethodRuleFilter],
  ['transactionTypes', TransactionTypeRuleFilter],
  ['transactionState', TransactionStateRuleFilter],
])

export const TRANSACTION_FILTERS = Object.fromEntries(_TRANSACTION_FILTERS) as {
  [key: string]: typeof TransactionRuleFilter
}

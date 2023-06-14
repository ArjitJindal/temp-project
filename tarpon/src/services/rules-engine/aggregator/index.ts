import { UserTransactionCountries } from './user-transaction-countries'
import { UserTransactionCurrencies } from './user-transaction-currencies'
import { UserTransactionsCount } from './user-transactions-count'
import { UserTransactionStatsTimeGroup } from './user-transaction-stats-by-time'

export const Aggregators = [
  UserTransactionCountries,
  UserTransactionCurrencies,
  UserTransactionsCount,
  UserTransactionStatsTimeGroup,
]

export const AGGREGATORS = {
  UserTransactionCountries: UserTransactionCountries,
  UserTransactionCurrencies: UserTransactionCurrencies,
  UserTransactionsCount: UserTransactionsCount,
  UserTransactionStatsTimeGroup: UserTransactionStatsTimeGroup,
}

export type AggregatorName = keyof typeof AGGREGATORS

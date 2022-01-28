import { UserLastTransactionsTime } from './user-last-transaction-time'
import { UserTransactionCountries } from './user-transaction-countries'
import { UserTransactionCurrencies } from './user-transaction-currencies'
import { UserTransactionsCount } from './user-transactions-count'

export const Aggregators = [
  UserTransactionCountries,
  UserTransactionCurrencies,
  UserTransactionsCount,
  UserLastTransactionsTime,
]

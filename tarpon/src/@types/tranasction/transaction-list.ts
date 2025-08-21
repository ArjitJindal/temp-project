import { Transaction } from '../openapi-public/Transaction'

export type transactionListResult = {
  transactions: Transaction[]
  numberOfItems: number
  token?: string
}

export type TransactionAmountAggregates = {
  totalOriginAmount: number
  totalDeposits: number
  totalLoans: number
  totalLoanBalance: number
  totalTransactions: number
  totalAccounts: number
}

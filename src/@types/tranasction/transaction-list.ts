import { Transaction } from '../openapi/transaction'

export type transactionListResult = {
  transactions: Transaction[]
  numberOfItems: number
  token?: string
}

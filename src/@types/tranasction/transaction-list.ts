import { Transaction } from '../openapi-public/transaction'

export type transactionListResult = {
  transactions: Transaction[]
  numberOfItems: number
  token?: string
}

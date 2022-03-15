import { Transaction } from '../openapi-public/Transaction'

export type transactionListResult = {
  transactions: Transaction[]
  numberOfItems: number
  token?: string
}

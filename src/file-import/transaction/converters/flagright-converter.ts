import { Transaction } from '../../../@types/openapi-public/transaction'
import { TransactionConverterInterface } from './converter-interface'

export const FlagrightTransactionConverter: TransactionConverterInterface = {
  getCsvParserOptions() {
    return { headers: true }
  },
  validate(rawTransaction: any): string[] {
    return []
  },
  convert(rawTransaction: any): Transaction {
    // TODO: Implement
    return null as any
  },
}

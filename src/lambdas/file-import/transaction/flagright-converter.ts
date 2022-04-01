import { ConverterInterface } from '../converter-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'

export const FlagrightTransactionConverter: ConverterInterface<Transaction> = {
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

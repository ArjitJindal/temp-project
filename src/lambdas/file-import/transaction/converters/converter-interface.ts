import { ParserOptionsArgs } from '@fast-csv/parse'
import { Transaction } from '../../../../@types/openapi-public/transaction'

export interface TransactionConverterInterface {
  getCsvParserOptions(): ParserOptionsArgs
  validate(rawTransaction: unknown): string[]
  convert(rawTransaction: unknown): Transaction | null
}

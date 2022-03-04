import { ParserOptionsArgs } from '@fast-csv/parse'

export interface ConverterInterface<T> {
  getCsvParserOptions(): ParserOptionsArgs
  validate(item: unknown): string[]
  convert(item: unknown): T | null
}

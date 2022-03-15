import { Transaction } from '../../../@types/openapi-public/Transaction'
import { ConverterInterface } from '../converter-interface'
import { FlagrightTransactionConverter } from './flagright-converter'
import { ShPaymentTransactionConverter } from './sh-payment-converter'

const internalConverters = {
  'sh-payment': ShPaymentTransactionConverter,
  flagright: FlagrightTransactionConverter,
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<Transaction>
}

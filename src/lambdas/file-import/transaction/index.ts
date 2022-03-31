import { ConverterInterface } from '../converter-interface'
import { FlagrightConverter } from '../flagright-converter'
import { ShPaymentTransactionConverter } from './sh-payment-converter'
import { Transaction } from '@/@types/openapi-public/Transaction'

const internalConverters = {
  'sh-payment': new ShPaymentTransactionConverter(),
  flagright: new FlagrightConverter('Transaction'),
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<Transaction>
}

import { ConverterInterface } from '../converter-interface'
import { FlagrightConverter } from '../flagright-converter'
import { ShPaymentBusinessConverter } from './sh-payment-converter'
import { Business } from '@/@types/openapi-public/Business'

const internalConverters = {
  'sh-payment': new ShPaymentBusinessConverter(),
  flagright: new FlagrightConverter('Business'),
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<Business>
}

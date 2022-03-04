import { Business } from '../../../@types/openapi-public/business'
import { ConverterInterface } from '../converter-interface'
import { FlagrightBusinessConverter } from './flagright-converter'
import { ShPaymentBusinessConverter } from './sh-payment-converter'

const internalConverters = {
  'sh-payment': ShPaymentBusinessConverter,
  flagright: FlagrightBusinessConverter,
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<Business>
}

import { ConverterInterface } from '../converter-interface'
import { FlagrightUserConverter } from './flagright-converter'
import { ShPaymentUserConverter } from './sh-payment-converter'
import { User } from '@/@types/openapi-public/User'

const internalConverters = {
  'sh-payment': ShPaymentUserConverter,
  flagright: FlagrightUserConverter,
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<User>
}

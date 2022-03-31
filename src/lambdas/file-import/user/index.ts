import { ConverterInterface } from '../converter-interface'
import { FlagrightConverter } from '../flagright-converter'
import { ShPaymentUserConverter } from './sh-payment-converter'
import { User } from '@/@types/openapi-public/User'

const internalConverters = {
  'sh-payment': new ShPaymentUserConverter(),
  flagright: new FlagrightConverter('User'),
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<User>
}

import { ConverterInterface } from '../converter-interface'
import { FlagrightConverter } from '../flagright-converter'
import { User } from '@/@types/openapi-public/User'

const internalConverters = {
  flagright: new FlagrightConverter('User'),
}

export type ImportFormat = keyof typeof internalConverters
export const converters = internalConverters as unknown as {
  [key: string]: ConverterInterface<User>
}

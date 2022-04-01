import { ConverterInterface } from '../converter-interface'
import { User } from '@/@types/openapi-public/User'

export const FlagrightUserConverter: ConverterInterface<User> = {
  getCsvParserOptions() {
    return { headers: true }
  },
  validate(rawUser: any): string[] {
    return []
  },
  convert(rawUser: any): User {
    // TODO: Implement
    return null as any
  },
}

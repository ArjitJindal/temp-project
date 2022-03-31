import * as t from 'io-ts'
import reporter from 'io-ts-reporters'

import { ConverterInterface } from '../converter-interface'
import { User } from '@/@types/openapi-public/User'

const ShPaymentUser = t.type({
  // TBD
})
type ShPaymentUser = t.TypeOf<typeof ShPaymentUser>

export class ShPaymentUserConverter implements ConverterInterface<User> {
  async initialize(): Promise<void> {
    return
  }
  getCsvParserOptions() {
    // TBD
    return { headers: true }
  }
  validate(rawUser: ShPaymentUser): string[] {
    return reporter.report(ShPaymentUser.decode(rawUser))
  }
  convert(rawUser: ShPaymentUser): User | null {
    // TBD
    return null
  }
}

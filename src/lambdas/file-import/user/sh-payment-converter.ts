import * as t from 'io-ts'
import reporter from 'io-ts-reporters'

import { User } from '../../../@types/openapi-public/User'
import { ConverterInterface } from '../converter-interface'

const ShPaymentUser = t.type({
  // TBD
})
type ShPaymentUser = t.TypeOf<typeof ShPaymentUser>

export const ShPaymentUserConverter: ConverterInterface<User> = {
  getCsvParserOptions() {
    // TBD
    return { headers: true }
  },
  validate(rawUser: ShPaymentUser): string[] {
    return reporter.report(ShPaymentUser.decode(rawUser))
  },
  convert(rawUser: ShPaymentUser): User | null {
    // TBD
    return null
  },
}

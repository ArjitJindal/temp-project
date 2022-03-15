import * as t from 'io-ts'
import reporter from 'io-ts-reporters'

import { Business } from '../../../@types/openapi-public/Business'
import { ConverterInterface } from '../converter-interface'

const ShPaymentBusiness = t.type({
  // TBD
})
type ShPaymentBusiness = t.TypeOf<typeof ShPaymentBusiness>

export const ShPaymentBusinessConverter: ConverterInterface<Business> = {
  getCsvParserOptions() {
    // TBD
    return { headers: true }
  },
  validate(rawBusiness: ShPaymentBusiness): string[] {
    return reporter.report(ShPaymentBusiness.decode(rawBusiness))
  },
  convert(rawBusiness: ShPaymentBusiness): Business | null {
    // TBD
    return null
  },
}

import * as t from 'io-ts'
import reporter from 'io-ts-reporters'

import { ConverterInterface } from '../converter-interface'
import { Business } from '@/@types/openapi-public/Business'

const ShPaymentBusiness = t.type({
  'Customer name': t.string,
  'Internal customer id': t.string,
  Created: t.string,
  Account: t.string,
  'Operation limit': t.string,
  'Day limit': t.string,
  'Month limit': t.string,
})
type ShPaymentBusiness = t.TypeOf<typeof ShPaymentBusiness>

export class ShPaymentBusinessConverter
  implements ConverterInterface<Business>
{
  async initialize(): Promise<void> {
    return
  }
  getCsvParserOptions() {
    return { headers: true }
  }
  validate(rawBusiness: ShPaymentBusiness): string[] {
    return reporter.report(ShPaymentBusiness.decode(rawBusiness))
  }
  convert(rawBusiness: ShPaymentBusiness): Business | null {
    return {
      userId: rawBusiness['Internal customer id'],
      createdTimestamp: parseInt(rawBusiness.Created.replace(',', '')),
      legalEntity: {
        companyGeneralDetails: {
          legalName: rawBusiness['Customer name'],
        },
      },
      transactionLimits: {
        maximumDailyTransactionLimit: {
          amountValue: parseInt(rawBusiness['Day limit']),
          amountCurrency: 'EUR',
        },
        maximumMonthlyTransactionLimit: {
          amountValue: parseInt(rawBusiness['Month limit']),
          amountCurrency: 'EUR',
        },
      },
      tags: [{ key: 'Account', value: rawBusiness.Account }],
    }
  }
}

import { JSONSchemaType } from 'ajv'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { expandCountryGroup } from '@/utils/countries'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export function transactionCardIssuedCountryPredicate(
  transaction: Transaction,
  transactionCountries?: string[]
) {
  if (!transactionCountries?.length) {
    return true
  }

  transactionCountries = expandCountryGroup(transactionCountries)

  if (
    transaction.originPaymentDetails?.method === 'CARD' &&
    transaction?.originPaymentDetails?.cardIssuedCountry != null
  ) {
    return transactionCountries.includes(
      (transaction.originPaymentDetails as CardDetails)
        .cardIssuedCountry as string
    )
  } else if (
    transaction.destinationPaymentDetails?.method === 'CARD' &&
    transaction?.destinationPaymentDetails?.cardIssuedCountry != null
  ) {
    return transactionCountries.includes(
      (transaction.destinationPaymentDetails as CardDetails)
        .cardIssuedCountry as string
    )
  }
  return false
}

export type TransactionCardIssuedCountryFilterParameter = {
  transactionCardIssuedCountries?: string[]
}

export class TransactionCardIssuedCountry extends TransactionRuleFilter<TransactionCardIssuedCountryFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionCardIssuedCountryFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionCardIssuedCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Transaction card issued countries',
          description:
            'Filters origin and destination card issued countries indside the payment details on which the rule will be applied',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return transactionCardIssuedCountryPredicate(
      this.transaction,
      this.parameters.transactionCardIssuedCountries
    )
  }
}

import { JSONSchemaType } from 'ajv'
import capitalize from 'lodash/capitalize'
import isEmpty from 'lodash/isEmpty'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { expandCountryGroup } from '@/utils/countries'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

export function transactionCountryRuleFilterPredicate(
  amountDetails: TransactionAmountDetails | undefined,
  parameterCountries: string[]
) {
  if (!amountDetails) {
    return false
  }

  parameterCountries = expandCountryGroup(parameterCountries)
  return parameterCountries.some((x) => x === amountDetails.country)
}

export type OriginTransactionCountryRuleFilterParameter = {
  originTransactionCountries?: string[]
}

export type DestinationTransactionCountryRuleFilterParameter = {
  destinationTransactionCountries?: string[]
}

export abstract class TransactionCountryRuleFilterBase<
  Params extends
    | OriginTransactionCountryRuleFilterParameter
    | DestinationTransactionCountryRuleFilterParameter
> extends TransactionRuleFilter<Params> {
  public static getBaseSchema<
    P extends
      | OriginTransactionCountryRuleFilterParameter
      | DestinationTransactionCountryRuleFilterParameter
  >(direction: 'origin' | 'destination'): JSONSchemaType<P> {
    const countriesSchema = COUNTRIES_OPTIONAL_SCHEMA({
      title: `${capitalize(direction)} transaction countries`,
      description: `Filters ${direction} countries inside the payment details on which the rule will be applied`,
      uiSchema: {
        group: 'transaction',
      },
    })

    let schema: JSONSchemaType<P>

    if (direction === 'origin') {
      schema = {
        type: 'object',
        properties: {
          originTransactionCountries: countriesSchema,
        },
      } as JSONSchemaType<P>
    } else {
      schema = {
        type: 'object',
        properties: {
          destinationTransactionCountries: countriesSchema,
        },
      } as JSONSchemaType<P>
    }

    return schema
  }

  public abstract getDirection(): 'origin' | 'destination'

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    const direction = this.getDirection()

    const parameterCountries =
      direction === 'origin'
        ? (this.parameters as OriginTransactionCountryRuleFilterParameter)
            .originTransactionCountries
        : (this.parameters as DestinationTransactionCountryRuleFilterParameter)
            .destinationTransactionCountries

    if (!parameterCountries || isEmpty(parameterCountries)) {
      return true
    }

    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails

    return transactionCountryRuleFilterPredicate(
      amountDetails,
      parameterCountries
    )
  }
}

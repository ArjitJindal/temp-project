import { JSONSchemaType } from 'ajv'
import { capitalize, isEmpty } from 'lodash'
import {
  CARD_PAYMENT_CHANNELS_OPTIONAL_SCHEMA,
  COUNTRIES_OPTIONAL_SCHEMA,
  PAYMENT_METHODS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type PaymentRuleFiltersChildParameters = {
  paymentMethods?: PaymentMethod[]
  walletType?: string
  cardIssuedCountries?: string[]
  cardPaymentChannels?: string[]
  mccCodes?: string[]
}

export type OriginPaymentRuleFiltersParameters = {
  originPaymentFilters?: PaymentRuleFiltersChildParameters
}

export type DestinationPaymentRuleFiltersParameters = {
  destinationPaymentFilters?: PaymentRuleFiltersChildParameters
}

const checkPaymentMethod = (
  paymentDetails: PaymentDetails | undefined,
  parameters: PaymentRuleFiltersChildParameters
): boolean => {
  const paymentMethods = parameters?.paymentMethods
  const tranasctionPaymentMethod = paymentDetails?.method

  if (!paymentMethods?.length) {
    return true
  }

  if (!tranasctionPaymentMethod) {
    return false
  }

  if (paymentMethods.includes(tranasctionPaymentMethod)) {
    if (tranasctionPaymentMethod === 'CARD') {
      const cardIssuedCountry = paymentDetails?.cardIssuedCountry
      const filterCardIssuedCountries = parameters?.cardIssuedCountries

      if (filterCardIssuedCountries?.length) {
        if (!cardIssuedCountry) {
          return false
        }
        return filterCardIssuedCountries.includes(cardIssuedCountry)
      }

      const paymentChannel = paymentDetails?.paymentChannel
      const filterPaymentChannels = parameters?.cardPaymentChannels

      if (filterPaymentChannels?.length) {
        if (!paymentChannel) {
          return false
        }
        return filterPaymentChannels.includes(paymentChannel)
      }

      const mccCode = paymentDetails?.merchantDetails?.MCC
      const filterMccCodes = parameters?.mccCodes

      if (filterMccCodes?.length) {
        if (!mccCode) {
          return false
        }
        return filterMccCodes.includes(mccCode)
      }

      return true
    } else if (tranasctionPaymentMethod === 'WALLET') {
      const walletType = paymentDetails?.walletType
      const filterWalletType = parameters?.walletType

      if (filterWalletType) {
        if (!walletType) {
          return false
        }
        return filterWalletType === walletType
      }
    }
    return true
  }

  return false
}

export abstract class PaymentFilterRuleFilterBase<
  Params extends
    | OriginPaymentRuleFiltersParameters
    | DestinationPaymentRuleFiltersParameters
> extends TransactionRuleFilter<Params> {
  public static getBaseSchema<
    T extends
      | DestinationPaymentRuleFiltersParameters
      | OriginPaymentRuleFiltersParameters
  >(direction: 'origin' | 'destination'): JSONSchemaType<T> {
    const childPaymentFiltersSchema: JSONSchemaType<PaymentRuleFiltersChildParameters> =
      {
        type: 'object',
        properties: {
          paymentMethods: PAYMENT_METHODS_OPTIONAL_SCHEMA({}),
          walletType: {
            type: 'string',
            title: 'Wallet Type',
            description:
              'Add wallet type to only run this rule for certain wallet types',
            nullable: true,
          },
          cardIssuedCountries: COUNTRIES_OPTIONAL_SCHEMA({
            title: 'Transaction card issued countries',
            description:
              'Filters origin and destination card issued countries indside the payment details on which the rule will be applied',
            uiSchema: {
              group: 'transaction',
            },
          }),
          cardPaymentChannels: CARD_PAYMENT_CHANNELS_OPTIONAL_SCHEMA({}),
          mccCodes: {
            type: 'array',
            title: 'MCC Codes',
            description:
              'Add MCC codes to only run this rule for certain MCC codes',
            items: {
              type: 'string',
            },
            uniqueItems: true,
            nullable: true,
          },
        },
      }

    const schemaProperties = {
      type: 'object',
      title: `${capitalize(direction)} payment filters`,
      description: `Filters ${direction} payment methods, wallet types, card issued countries and payment channels inside the payment details on which the rule will be applied`,
      nullable: true,
      'ui:schema': {
        'ui:group': 'transaction',
        'ui:subtype': 'PAYMENT_FILTERS',
      },
    }

    let schema: JSONSchemaType<T>

    if (direction === 'origin') {
      schema = {
        type: 'object',
        properties: {
          originPaymentFilters: {
            ...schemaProperties,
            properties: childPaymentFiltersSchema.properties,
          },
        },
      } as JSONSchemaType<OriginPaymentRuleFiltersParameters>
    } else {
      schema = {
        type: 'object',
        properties: {
          destinationPaymentFilters: {
            ...schemaProperties,
            properties: childPaymentFiltersSchema.properties,
          },
        },
      } as JSONSchemaType<DestinationPaymentRuleFiltersParameters>
    }

    return schema
  }

  public abstract getDirection(): 'origin' | 'destination'

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    const direction = this.getDirection()
    const parameters =
      direction === 'origin'
        ? (this.parameters as OriginPaymentRuleFiltersParameters)
            .originPaymentFilters
        : (this.parameters as DestinationPaymentRuleFiltersParameters)
            .destinationPaymentFilters

    if (isEmpty(parameters)) {
      return true
    }

    const paymentDetails =
      direction === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails

    if (!paymentDetails) {
      return false
    }

    return checkPaymentMethod(paymentDetails, parameters)
  }
}

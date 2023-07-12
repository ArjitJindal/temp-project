import { JSONSchemaType } from 'ajv'
import {
  CARD_PAYMENT_CHANNELS_OPTIONAL_SCHEMA,
  COUNTRIES_OPTIONAL_SCHEMA,
  PAYMENT_METHODS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type PaymentFilterRuleFilterParameter = {
  paymentFilters?: {
    paymentMethods?: PaymentMethod[]
    walletType?: string
    cardIssuedCountries?: string[]
    cardPaymentChannels?: string[]
  }
}

const checkPaymentMethod = (
  paymentDetails: PaymentDetails | undefined,
  parameters: PaymentFilterRuleFilterParameter
): boolean => {
  const paymentMethods = parameters?.paymentFilters?.paymentMethods
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
      const filterCardIssuedCountries =
        parameters?.paymentFilters?.cardIssuedCountries

      if (filterCardIssuedCountries?.length) {
        if (!cardIssuedCountry) {
          return false
        }
        return filterCardIssuedCountries.includes(cardIssuedCountry)
      }

      const paymentChannel = paymentDetails?.paymentChannel
      const filterPaymentChannels =
        parameters?.paymentFilters?.cardPaymentChannels

      if (filterPaymentChannels?.length) {
        if (!paymentChannel) {
          return false
        }
        return filterPaymentChannels.includes(paymentChannel)
      }

      return true
    } else if (tranasctionPaymentMethod === 'WALLET') {
      const walletType = paymentDetails?.walletType
      const filterWalletType = parameters?.paymentFilters?.walletType

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

export class PaymentFilterRuleFilter extends TransactionRuleFilter<PaymentFilterRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentFilterRuleFilterParameter> {
    return {
      type: 'object',

      properties: {
        paymentFilters: {
          type: 'object',
          title: 'Payment Filters',
          description:
            'Filters payment methods, wallet types, card issued countries and payment channels inside the payment details on which the rule will be applied',
          nullable: true,
          'ui:schema': {
            'ui:group': 'transaction',
            'ui:subtype': 'PAYMENT_FILTERS',
          },
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
          },
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (!this.parameters.paymentFilters) {
      return true
    }

    if (!this.parameters?.paymentFilters?.paymentMethods?.length) {
      return true
    }

    const transaction = this.transaction

    return (
      checkPaymentMethod(transaction?.originPaymentDetails, this.parameters) ||
      checkPaymentMethod(
        transaction?.destinationPaymentDetails,
        this.parameters
      )
    )
  }
}

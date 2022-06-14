import { JSONSchemaType } from 'ajv'
import { businessName, getFullName } from '../utils/users'
import { TransactionRule } from './rule'
import { Business } from '@/@types/openapi-public/Business'
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'

export type MerchantReceiverNameRuleParameters = {
  merchantNames: string[]
}

export default class MerchantReceiverNameRule extends TransactionRule<MerchantReceiverNameRuleParameters> {
  public static getSchema(): JSONSchemaType<MerchantReceiverNameRuleParameters> {
    return {
      type: 'object',
      properties: {
        merchantNames: {
          type: 'array',
          title: 'Merchant Names',
          items: { type: 'string' },
        },
      },
      required: ['merchantNames'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [
      () => this.transaction.destinationPaymentDetails?.method === 'WALLET',
    ]
  }

  public async computeRule() {
    const { merchantNames } = this.parameters
    const receiverName = (
      this.transaction.destinationPaymentDetails as WalletDetails
    ).name
    if (
      receiverName &&
      merchantNames.findIndex((element) => {
        if (receiverName.includes(element)) {
          return true
        }
      }) !== -1
    ) {
      return { action: this.action }
    }
  }
}

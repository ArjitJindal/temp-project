import { JSONSchemaType } from 'ajv'
import { TransactionRule } from './rule'
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
    }
  }

  public async computeRule() {
    if (this.transaction.destinationPaymentDetails?.method !== 'WALLET') {
      return
    }

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
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('destination'),
          receiverName,
        },
      }
    }
  }
}

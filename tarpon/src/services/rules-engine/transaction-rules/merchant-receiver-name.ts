import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'
import { traceable } from '@/core/xray'

export type MerchantReceiverNameRuleParameters = {
  merchantNames: string[]
}

@traceable
export default class MerchantReceiverNameRule extends TransactionRule<MerchantReceiverNameRuleParameters> {
  public static getSchema(): JSONSchemaType<MerchantReceiverNameRuleParameters> {
    return {
      type: 'object',
      properties: {
        merchantNames: {
          type: 'array',
          title: 'Merchant names',
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

    const hitResult: RuleHitResult = []
    if (
      receiverName &&
      merchantNames.findIndex((element) => {
        if (receiverName.includes(element)) {
          return true
        }
      }) !== -1
    ) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          receiverName,
        },
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }
}

import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { getConsumerName, isUserType } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type CardHolderNameRuleParameter = {
  allowedDistance: number
}

export default class CardHolderNameRule extends TransactionRule<CardHolderNameRuleParameter> {
  public static getSchema(): JSONSchemaType<CardHolderNameRuleParameter> {
    return {
      type: 'object',
      properties: {
        allowedDistance: {
          type: 'integer',
          title:
            'Maximum number of single-character edits (Levenshtein distance)',
        },
      },
      required: ['allowedDistance'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [
      () => this.transaction.originPaymentDetails?.method === 'CARD',
      () => isUserType(this.senderUser, 'CONSUMER'),
    ]
  }

  public async computeRule() {
    const { allowedDistance } = this.parameters
    const userName = getConsumerName(
      (this.senderUser as User).userDetails.name,
      true
    )

    const cardName = getConsumerName(
      (this.transaction.originPaymentDetails as CardDetails).nameOnCard!,
      true
    )
    const distance = levenshtein.get(userName, cardName)
    if (distance > allowedDistance) {
      const vars = super.getTransactionVars('origin')
      let cardFingerprint = null
      const originPaymentDetails = this.transaction.originPaymentDetails
      if (originPaymentDetails?.method === 'CARD') {
        cardFingerprint = originPaymentDetails.cardFingerprint
      }

      return {
        action: this.action,
        vars: { ...vars, cardFingerprint },
      }
    }
  }
}

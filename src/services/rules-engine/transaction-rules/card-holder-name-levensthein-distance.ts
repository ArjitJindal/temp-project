import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { getConsumerName, isUserType } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type CardHolderNameRuleParameter = {
  allowedDistancePercentage: number
}

export default class CardHolderNameRule extends TransactionRule<CardHolderNameRuleParameter> {
  public static getSchema(): JSONSchemaType<CardHolderNameRuleParameter> {
    return {
      type: 'object',
      properties: {
        allowedDistancePercentage: {
          type: 'integer',
          title: 'Fuzziness (Levenshtein distance)',
          description:
            'For example specifying 50% means that allowed Levenshtein distance will be half of the number of characters in username.',
          minimum: 0,
          maximum: 100,
        },
      },
      required: ['allowedDistancePercentage'],
    }
  }

  public getFilters() {
    return [
      () => this.transaction.originPaymentDetails?.method === 'CARD',
      () => isUserType(this.senderUser, 'CONSUMER'),
      () => !!(this.senderUser as User).userDetails,
    ]
  }

  public async computeRule() {
    const { allowedDistancePercentage } = this.parameters
    const userName = getConsumerName(
      (this.senderUser as User).userDetails!.name,
      true
    )
    const userNameLength = userName.length
    const cardName = getConsumerName(
      (this.transaction.originPaymentDetails as CardDetails).nameOnCard!,
      true
    )
    const distance = levenshtein.get(userName, cardName)
    if (distance > (allowedDistancePercentage / 100) * userNameLength) {
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

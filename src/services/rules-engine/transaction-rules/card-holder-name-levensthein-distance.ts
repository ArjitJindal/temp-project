import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { getConsumerName } from '../utils/user-rule-utils'
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

  public async computeRule() {
    const { allowedDistancePercentage } = this.parameters
    const originUserName = getConsumerName(
      (this.senderUser as User)?.userDetails?.name,
      true
    )
    const destinatinoUserName = getConsumerName(
      (this.receiverUser as User)?.userDetails?.name,
      true
    )
    const originCardName = getConsumerName(
      (this.transaction.originPaymentDetails as CardDetails)?.nameOnCard,
      true
    )
    const destinationCardName = getConsumerName(
      (this.transaction.destinationPaymentDetails as CardDetails)?.nameOnCard,
      true
    )

    if (
      originCardName &&
      originUserName &&
      levenshtein.get(originUserName, originCardName) >
        (allowedDistancePercentage / 100) * originUserName.length
    ) {
      const vars = super.getTransactionVars('origin')

      return {
        action: this.action,
        vars: {
          ...vars,
          cardFingerprint: (
            this.transaction.originPaymentDetails as CardDetails
          )?.cardFingerprint,
        },
      }
    }
    if (
      destinationCardName &&
      destinatinoUserName &&
      levenshtein.get(destinatinoUserName, destinationCardName) >
        (allowedDistancePercentage / 100) * destinatinoUserName.length
    ) {
      const vars = super.getTransactionVars('destination')

      return {
        action: this.action,
        vars: {
          ...vars,
          cardFingerprint: (
            this.transaction.destinationPaymentDetails as CardDetails
          )?.cardFingerprint,
        },
      }
    }
  }
}

import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { getConsumerName } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
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

    const hitResult: RuleHitResult = []
    if (
      originCardName &&
      originUserName &&
      levenshtein.get(originUserName, originCardName) >
        (allowedDistancePercentage / 100) * originUserName.length
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          cardFingerprint: (
            this.transaction.originPaymentDetails as CardDetails
          )?.cardFingerprint,
        },
      })
    }
    if (
      destinationCardName &&
      destinatinoUserName &&
      levenshtein.get(destinatinoUserName, destinationCardName) >
        (allowedDistancePercentage / 100) * destinatinoUserName.length
    ) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          cardFingerprint: (
            this.transaction.destinationPaymentDetails as CardDetails
          )?.cardFingerprint,
        },
      })
    }
    return hitResult
  }
}

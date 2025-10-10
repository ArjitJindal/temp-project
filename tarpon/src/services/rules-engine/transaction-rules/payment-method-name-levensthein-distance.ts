import { JSONSchemaType } from 'ajv'
import { getEditDistance } from '@flagright/lib/utils'
import { RuleHitResultItem } from '../rule'
import { removePrefixFromName } from '../utils/transaction-rule-utils'
import { LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_SCHEMA } from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'
import { businessName, consumerName, formatConsumerName } from '@/utils/helpers'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/utils/payment-details'
import { traceable } from '@/core/xray'
import { Business } from '@/@types/openapi-public/Business'

export type PaymentMethodNameRuleParameter = {
  allowedDistancePercentage: number
  ignoreEmptyName?: boolean
}

@traceable
export default class PaymentMethodNameNameRule extends TransactionRule<PaymentMethodNameRuleParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodNameRuleParameter> {
    return {
      type: 'object',
      properties: {
        allowedDistancePercentage:
          LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_SCHEMA({}),
        ignoreEmptyName: {
          type: 'boolean',
          nullable: true,
        },
      },
      required: ['allowedDistancePercentage'],
    }
  }

  private getPaymentMethodName(
    details: PaymentDetails | undefined
  ): string | undefined {
    if (!details) {
      return
    }
    if (details.method === 'CARD') {
      return formatConsumerName(details.nameOnCard, true)
    }

    if (
      details.method === 'GENERIC_BANK_ACCOUNT' ||
      details.method === 'IBAN' ||
      details.method === 'ACH' ||
      details.method === 'CHECK' ||
      details.method === 'WALLET' ||
      details.method === 'SWIFT'
    ) {
      return details.name
    }
  }

  private async computeUserRule(
    direction: 'origin' | 'destination',
    user: User | Business,
    paymentDetails: PaymentDetails | undefined
  ): Promise<RuleHitResultItem | undefined> {
    if (!paymentDetails) {
      return
    }
    const paymentMethodName = this.getPaymentMethodName(paymentDetails)
    const { allowedDistancePercentage } = this.parameters
    const userName = isConsumerUser(user)
      ? consumerName(user as User, true)
      : businessName(user as Business)

    if (
      ((!userName && paymentMethodName) || (userName && !paymentMethodName)) &&
      !this.parameters.ignoreEmptyName
    ) {
      return {
        direction: direction.toUpperCase() as 'ORIGIN' | 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          paymentMethodIdentifier: getPaymentMethodId(paymentDetails),
        },
      }
    }

    if (!userName || !paymentMethodName) {
      return
    }

    // Choose the minimum score from trying with and without the prefixes.
    const paymentMethodNameWithoutPrefix = removePrefixFromName(
      paymentMethodName,
      true
    )

    const paymentMethodNameWithoutPrexiAndMiddleNames = extractFirstAndLastName(
      paymentMethodNameWithoutPrefix
    )

    const minDistance = Math.min(
      ...[paymentMethodName, paymentMethodNameWithoutPrexiAndMiddleNames].map(
        (str) => {
          return getEditDistance(userName.toLowerCase(), str || '')
        }
      )
    )

    if (minDistance > (allowedDistancePercentage / 100) * userName.length) {
      return {
        direction: direction.toUpperCase() as 'ORIGIN' | 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          paymentMethodIdentifier: getPaymentMethodId(paymentDetails),
        },
      }
    }
  }

  public async computeRule() {
    return {
      ruleHitResult: (
        await Promise.all([
          this.senderUser &&
            this.computeUserRule(
              'origin',
              this.senderUser,
              this.transaction.originPaymentDetails
            ),
          this.receiverUser &&
            this.computeUserRule(
              'destination',
              this.receiverUser,
              this.transaction.destinationPaymentDetails
            ),
        ])
      )
        .filter(Boolean)
        .flat(),
    }
  }
}

export function extractFirstAndLastName(fullName: string): string | undefined {
  const names = fullName.split(' ')
  if (names.length < 2) {
    return fullName
  }
  return `${names[0]} ${names[names.length - 1]}`
}

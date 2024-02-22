import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { RuleHitResultItem } from '../rule'
import { removePrefixFromName } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'
import { formatConsumerName } from '@/utils/helpers'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { traceable } from '@/core/xray'

export type PaymentMethodNameRuleParameter = {
  allowedDistancePercentage: number
  ignoreEmptyName?: boolean
  checkDirection?: 'sending' | 'receiving' | 'all'
}

@traceable
export default class PaymentMethodNameNameRule extends TransactionRule<PaymentMethodNameRuleParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodNameRuleParameter> {
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
        checkDirection: {
          type: 'string',
          title: 'Transaction history scope options',
          description:
            "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions",
          enum: ['sending', 'receiving', 'all'],
          nullable: true,
        },
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
    user: User,
    paymentDetails: PaymentDetails | undefined
  ): Promise<RuleHitResultItem | undefined> {
    if (!paymentDetails) {
      return
    }
    const paymentMethodName = this.getPaymentMethodName(paymentDetails)
    const { allowedDistancePercentage } = this.parameters
    const userName = formatConsumerName((user as User)?.userDetails?.name, true)

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
          return levenshtein.get(userName.toLowerCase(), str || '')
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
    const tasks: Promise<RuleHitResultItem | undefined>[] = []

    const checkAll =
      this.parameters.checkDirection === 'all' ||
      !this.parameters.checkDirection
    if (this.parameters.checkDirection === 'sending' || checkAll) {
      tasks.push(
        this.computeUserRule(
          'origin',
          this.senderUser as User,
          this.transaction.originPaymentDetails
        )
      )
    }
    if (this.parameters.checkDirection === 'receiving' || checkAll) {
      tasks.push(
        this.computeUserRule(
          'destination',
          this.receiverUser as User,
          this.transaction.destinationPaymentDetails
        )
      )
    }

    return await Promise.all(tasks)
  }
}

export function extractFirstAndLastName(fullName: string): string | undefined {
  const names = fullName.split(' ')
  if (names.length < 2) {
    return fullName
  }
  return `${names[0]} ${names[names.length - 1]}`
}

import { JSONSchemaType } from 'ajv'
import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
import { isUserBetweenAge, isUserType } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange?: {
    minAge?: number
    maxAge?: number
  }
  // optional parameter
  transactionType?: string
  paymentMethod?: PaymentMethod
  userType?: UserType
}

export default class TransactionAmountRule extends TransactionRule<TransactionAmountRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: {
          type: 'object',
          title: 'Transaction Amount Threshold',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        ageRange: {
          type: 'object',
          title: 'Target Age Range',
          properties: {
            minAge: { type: 'integer', title: 'Min Age', nullable: true },
            maxAge: { type: 'integer', title: 'Max Age', nullable: true },
          },
          required: [],
          nullable: true,
        },
        transactionType: {
          type: 'string',
          title: 'Target Transaction Type',
          nullable: true,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          enum: ['ACH', 'CARD', 'IBAN', 'SWIFT', 'UPI', 'WALLET'],
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          enum: ['CONSUMER', 'BUSINESS'],
          nullable: true,
        },
      },
      required: ['transactionAmountThreshold'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { ageRange, transactionType, paymentMethod, userType } =
      this.parameters
    return [
      () => !ageRange || isUserBetweenAge(this.senderUser, ageRange),
      () => !transactionType || this.transaction.type === transactionType,
      () =>
        !paymentMethod ||
        this.transaction.originPaymentDetails?.method === paymentMethod,
      () => isUserType(this.senderUser, userType),
    ]
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters
    if (
      await isTransactionAmountAboveThreshold(
        this.transaction.originAmountDetails,
        transactionAmountThreshold
      )
    ) {
      const { transactionAmountThreshold } = this.parameters

      const thresholdsInUsd = await Promise.all(
        Object.entries(transactionAmountThreshold).map(([currency, amount]) => {
          return getTargetCurrencyAmount(
            { transactionAmount: amount, transactionCurrency: currency },
            'USD'
          )
        })
      )

      const usdLimit = thresholdsInUsd
        .map((x) => x.transactionAmount)
        .reduce((acc, x) => (acc === 0 ? x : Math.min(acc, x)))

      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars(null),
          usdLimit: usdLimit.toFixed(2),
        },
      }
    }
  }
}

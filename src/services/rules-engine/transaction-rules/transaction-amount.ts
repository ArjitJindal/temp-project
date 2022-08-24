import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import {
  checkTransactionAmountBetweenThreshold,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import { isUserBetweenAge, isUserType } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange?: {
    minAge?: number
    maxAge?: number
  }
  // optional parameter
  transactionTypes?: TransactionType[]
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
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
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
    }
  }

  public getFilters() {
    const { ageRange, transactionTypes, paymentMethod, userType } =
      this.parameters
    return [
      () => !ageRange || isUserBetweenAge(this.senderUser, ageRange),
      () => isTransactionInTargetTypes(this.transaction.type, transactionTypes),
      () =>
        !paymentMethod ||
        this.transaction.originPaymentDetails?.method === paymentMethod,
      () => isUserType(this.senderUser, userType),
    ]
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters

    const thresholdHit = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      _.mapValues(transactionAmountThreshold, (threshold) => ({
        min: threshold,
      }))
    )
    if (thresholdHit != null) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          limit: thresholdHit.min?.toFixed(2),
          currency: thresholdHit.currency,
        },
      }
    }
  }
}

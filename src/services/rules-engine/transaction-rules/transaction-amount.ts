import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import {
  checkTransactionAmountBetweenThreshold,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import { isUserBetweenAge, isUserType } from '../utils/user-rule-utils'
import {
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  AGE_RANGE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
  AgeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  // optional parameter
  ageRange?: AgeRange
  transactionTypes?: TransactionType[]
  paymentMethod?: PaymentMethod
  userType?: UserType
}

export default class TransactionAmountRule extends TransactionRule<TransactionAmountRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA(),
        ageRange: AGE_RANGE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
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

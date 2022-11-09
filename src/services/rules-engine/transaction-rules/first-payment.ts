import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { TransactionRepository } from '../repositories/transaction-repository'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'

export type FirstPaymentRuleParameter = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
}

export default class FirstPaymentRule extends TransactionRule<FirstPaymentRuleParameter> {
  public static getSchema(): JSONSchemaType<FirstPaymentRuleParameter> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA(),
      },
      required: [],
    }
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const thresholdHit = transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          _.mapValues(transactionAmountThreshold, (threshold) => ({
            min: threshold,
          }))
        )
      : true
    const isFirstPayment =
      this.transaction.originUserId &&
      !(await transactionRepository.hasAnySendingTransaction(
        this.transaction.originUserId,
        {}
      ))
    if (thresholdHit && isFirstPayment) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
  }
}

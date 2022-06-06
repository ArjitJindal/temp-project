import { JSONSchemaType } from 'ajv'
import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
import { isUserBetweenAge } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange?: {
    minAge: number
    maxAge: number
  }
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
            minAge: { type: 'integer', title: 'Min Age' },
            maxAge: { type: 'integer', title: 'Max Age' },
          },
          required: ['minAge', 'maxAge'],
          nullable: true,
        },
      },
      required: ['transactionAmountThreshold'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { ageRange } = this.parameters
    return [() => isUserBetweenAge(this.senderUser, ageRange)]
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters
    if (
      await isTransactionAmountAboveThreshold(
        this.transaction.originAmountDetails,
        transactionAmountThreshold
      )
    ) {
      return { action: this.action }
    }
  }
}

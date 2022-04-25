import { JSONSchemaType } from 'ajv'
import { Rule } from './rule'
import { isTransactionAmountAboveThreshold } from './utils/transaction-rule-utils'
import { isUserBetweenAge } from './utils/user-rule-utils'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange?: {
    minAge: number
    maxAge: number
  }
}

export default class TransactionAmountRule extends Rule<TransactionAmountRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: {
          type: 'object',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        ageRange: {
          type: 'object',
          properties: {
            minAge: { type: 'integer' },
            maxAge: { type: 'integer' },
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

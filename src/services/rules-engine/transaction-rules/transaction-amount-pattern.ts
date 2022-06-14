import { JSONSchemaType } from 'ajv'
import { boolean } from 'fp-ts'
import { orElse } from 'fp-ts/lib/EitherT'
import { TransactionRule } from './rule'

export type TransactionMatchesPatternRuleParameters = {
  patterns: string[]
  checkDecimal?: boolean
}

export default class TransactionMatchesPatternRule extends TransactionRule<TransactionMatchesPatternRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionMatchesPatternRuleParameters> {
    return {
      type: 'object',
      properties: {
        patterns: {
          type: 'array',
          title: 'Patterns',
          items: { type: 'string' },
        },
        checkDecimal: {
          type: 'boolean',
          title: 'Check Decimals',
          nullable: true,
        },
      },
      required: ['patterns'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [
      () =>
        this.transaction.originAmountDetails !== undefined &&
        this.transaction.originAmountDetails?.transactionAmount !== undefined,
    ]
  }

  public async computeRule() {
    const { patterns, checkDecimal } = this.parameters
    const originTransactionAmount =
      this.transaction.originAmountDetails?.transactionAmount

    const originTransactionAmountString = String(
      checkDecimal
        ? originTransactionAmount!
        : Math.trunc(originTransactionAmount!)
    )
    if (
      patterns.find((patterns) =>
        originTransactionAmountString.endsWith(patterns)
      )
    )
      return { action: this.action }
  }
}

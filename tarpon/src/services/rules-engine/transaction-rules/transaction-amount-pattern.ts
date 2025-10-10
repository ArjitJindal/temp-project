import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type TransactionMatchesPatternRuleParameters = {
  patterns: string[]
  checkDecimal?: boolean
}

@traceable
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
          title: 'Check decimals',
          nullable: true,
        },
      },
      required: ['patterns'],
    }
  }

  public async computeRule() {
    if (!this.transaction.originAmountDetails?.transactionAmount) {
      return
    }

    const { patterns, checkDecimal } = this.parameters
    const originTransactionAmount =
      this.transaction.originAmountDetails?.transactionAmount

    const originTransactionAmountString = String(
      checkDecimal
        ? originTransactionAmount
        : Math.trunc(originTransactionAmount)
    )
    const matchPattern = patterns.find((patterns) =>
      originTransactionAmountString.endsWith(patterns)
    )
    const hitResult: RuleHitResult = []
    if (matchPattern != null) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          matchPattern,
        },
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }
}

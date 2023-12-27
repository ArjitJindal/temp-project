import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export interface TransactionRiskScoreRuleParameters {
  riskScoreThreshold: number
}

@traceable
export class TransactionRiskScoreRule extends TransactionRule<TransactionRiskScoreRuleParameters> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    if (this.transactionRiskScore == null) {
      return
    }

    if (this.transactionRiskScore >= this.parameters.riskScoreThreshold) {
      return [
        {
          direction: 'ORIGIN',
          vars: {
            riskScore: this.transactionRiskScore,
          },
        },
      ]
    }

    return
  }

  public static getSchema(): JSONSchemaType<TransactionRiskScoreRuleParameters> {
    return {
      type: 'object',
      properties: {
        riskScoreThreshold: {
          type: 'number',
          title: 'Risk score threshold',
          description: 'The risk score threshold to trigger the rule',
        },
      },
      required: ['riskScoreThreshold'],
    }
  }
}

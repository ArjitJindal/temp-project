import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'

export interface TransactionRiskScoreRuleParameters {
  riskScoreThreshold: number
}

export class TransactionRiskScoreRule extends TransactionRule<TransactionRiskScoreRuleParameters> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
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

import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { PERCENT_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
export type MachineLearningGenericModelParameters = {
  confidenceScore: number
}

export default class MachineLearningGenericModel extends TransactionRule<MachineLearningGenericModelParameters> {
  public static getSchema(): JSONSchemaType<MachineLearningGenericModelParameters> {
    return {
      type: 'object',
      properties: {
        confidenceScore: PERCENT_OPTIONAL_SCHEMA({
          title: 'Confidence score (Range 0 -100)',
          description:
            'For example, specifying 80 (%) means that the rule will only be hit if the ML model has a confidence score of atleast 80% for this transaction.',
          maximum: 100,
        }),
      },
      additionalProperties: false,
      required: ['confidenceScore'],
    }
  }

  public async computeRule() {
    const hitResult: RuleHitResult = []
    return hitResult
  }
}

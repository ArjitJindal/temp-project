import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { TransactionRuleFilter } from './filter'
import { uiSchema } from '@/services/rules-engine/utils/rule-schema-utils'

export type CheckDirectionRuleFilterParameter = {
  checkDirection?: 'ORIGIN' | 'DESTINATION'
}

export class CheckDirectionRuleFilter extends TransactionRuleFilter<CheckDirectionRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<CheckDirectionRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        checkDirection: {
          type: 'string',
          enum: ['ORIGIN', 'DESTINATION'],
          title: 'User direction to check',
          description:
            'If set to ORIGIN, only origin user will be checked. If empty, both origin and destination users will be checked.',
          nullable: true,
          ...uiSchema({ group: 'transaction' }),
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    // NOTE: This filter applies after a rule is run
    return true
  }
}

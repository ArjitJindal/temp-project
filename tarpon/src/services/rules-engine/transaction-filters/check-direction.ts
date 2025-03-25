import { JSONSchemaType } from 'ajv'

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
          title: '{{UserAlias}} direction to check',
          description:
            'If set to ORIGIN, only origin {{userAlias}} will be checked. If empty, both origin and destination {{userAlias}}s will be checked.',
          nullable: true,
          ...uiSchema({ group: 'general' }),
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    // NOTE: This filter applies after a rule is run
    return true
  }
}

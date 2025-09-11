import { JSONSchemaType } from 'ajv'
import isEmpty from 'lodash/isEmpty'
import {
  TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { transactionTimeRangeRuleFilterPredicate } from './utils/helpers'

export type TransactionTimeRangeRuleFilterParameter = {
  transactionTimeRange24hr?: TransactionTimeRange
}

export class TransactionTimeRangeRuleFilter extends TransactionRuleFilter<TransactionTimeRangeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTimeRangeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTimeRange24hr: TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA({
          description:
            'Filters transactions based on a specified time range, accounting for the time zone of your residence',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }
  public static getDefaultValues(): TransactionTimeRangeRuleFilterParameter {
    return {
      transactionTimeRange24hr: undefined,
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    const transactionTimeRange: TransactionTimeRange | undefined =
      this.parameters.transactionTimeRange24hr
    if (!transactionTimeRange || isEmpty(transactionTimeRange)) {
      return true
    }

    return transactionTimeRangeRuleFilterPredicate(
      this.transaction.timestamp,
      transactionTimeRange
    )
  }
}

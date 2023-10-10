import { JSONSchemaType } from 'ajv'
import { isEmpty } from 'lodash'
import {
  TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'

export type TransactionTimeRangeRuleFilterParameter = {
  transactionTimeRange?: TransactionTimeRange
}

export const transactionTimeRangeRuleFilterPredicate = (
  transactionTimestamp: number,
  transactionTimeRange?: TransactionTimeRange
) => {
  if (!transactionTimeRange || isEmpty(transactionTimeRange)) {
    return true
  }
  const { startTime, endTime } = transactionTimeRange
  return startTime <= transactionTimestamp && endTime >= transactionTimestamp
}

export class TransactionTimeRangeRuleFilter extends TransactionRuleFilter<TransactionTimeRangeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTimeRangeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTimeRange: TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA({
          description: 'Filters transaction by the given time range',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public static getDefaultValues(): TransactionTimeRangeRuleFilterParameter {
    return {
      transactionTimeRange: undefined,
    }
  }

  public async predicate(): Promise<boolean> {
    return transactionTimeRangeRuleFilterPredicate(
      this.transaction.timestamp,
      this.parameters.transactionTimeRange
    )
  }
}

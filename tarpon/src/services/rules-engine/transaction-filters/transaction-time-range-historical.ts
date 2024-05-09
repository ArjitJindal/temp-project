import { JSONSchemaType } from 'ajv'
import { isEmpty } from 'lodash'
import {
  TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { transactionTimeRangeRuleFilterPredicate } from './utils/helpers'

export type TransactionTimeRangeHistoricalRuleFilterParameter = {
  transactionTimeRangeHistorical24hr?: TransactionTimeRange
}

export class TransactionTimeRangeHistoricalRuleFilter extends TransactionRuleFilter<TransactionTimeRangeHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTimeRangeHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTimeRangeHistorical24hr:
          TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA({
            description:
              'Filters all transactions including historical based on a specified time range, accounting for the time zone of your residence',
            uiSchema: {
              group: 'transaction_historical',
            },
          }),
      },
    }
  }

  public static getDefaultValues(): TransactionTimeRangeHistoricalRuleFilterParameter {
    return {
      transactionTimeRangeHistorical24hr: undefined,
    }
  }

  public async predicate(): Promise<boolean> {
    const transactionTimeRange: TransactionTimeRange | undefined =
      this.parameters.transactionTimeRangeHistorical24hr
    if (!transactionTimeRange || isEmpty(transactionTimeRange)) {
      return true
    }
    return transactionTimeRangeRuleFilterPredicate(
      this.transaction.timestamp,
      this.parameters.transactionTimeRangeHistorical24hr
    )
  }
}

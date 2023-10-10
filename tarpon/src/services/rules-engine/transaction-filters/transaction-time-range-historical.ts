import { JSONSchemaType } from 'ajv'
import { isEmpty } from 'lodash'
import {
  TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { transactionTimeRangeRuleFilterPredicate } from './transaction-time-range'

export type TransactionTimeRangeHistoricalRuleFilterParameter = {
  transactionTimeRangeHistorical?: TransactionTimeRange
}

export class TransactionTimeRangeHistoricalRuleFilter extends TransactionRuleFilter<TransactionTimeRangeHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTimeRangeHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTimeRangeHistorical: TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA({
          description:
            'Filters all transactions including historical transactions by the given time range',
          uiSchema: {
            group: 'transaction_historical',
          },
        }),
      },
    }
  }

  public static getDefaultValues(): TransactionTimeRangeHistoricalRuleFilterParameter {
    return {
      transactionTimeRangeHistorical: undefined,
    }
  }

  public async predicate(): Promise<boolean> {
    const transactionTimeRange: TransactionTimeRange | undefined =
      this.parameters.transactionTimeRangeHistorical
    if (!transactionTimeRange || isEmpty(transactionTimeRange)) {
      return true
    }
    const convertedTimeStamp = this.getConvertedTimeStamp(
      this.transaction.timestamp,
      transactionTimeRange
    )
    return transactionTimeRangeRuleFilterPredicate(
      convertedTimeStamp,
      this.parameters.transactionTimeRangeHistorical
    )
  }

  private getConvertedTimeStamp(
    timestamp: number,
    transactionTimeRange: TransactionTimeRange
  ) {
    const { startTime } = transactionTimeRange
    const transactionDate = new Date(timestamp * 1000)
    const transactionHours = transactionDate.getUTCHours()
    const transactionMinutes = transactionDate.getUTCMinutes()
    const transactionSeconds = transactionDate.getUTCSeconds()

    const convertedDate = new Date(startTime * 1000)
    convertedDate.setUTCHours(
      transactionHours,
      transactionMinutes,
      transactionSeconds
    )
    const convertedUnixTimestamp = Math.floor(convertedDate.getTime() / 1000)
    return convertedUnixTimestamp
  }
}

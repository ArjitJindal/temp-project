import { JSONSchemaType } from 'ajv'
import { isEmpty } from 'lodash'
import {
  TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA,
  TimeRangeHourAndMinute,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'

export type TransactionTimeRangeRuleFilterParameter = {
  transactionTimeRange24hr?: TransactionTimeRange
}

export const transactionTimeRangeRuleFilterPredicate = (
  transactionTimestamp: number,
  transactionTimeRange?: TransactionTimeRange
) => {
  if (!transactionTimeRange || isEmpty(transactionTimeRange)) {
    return true
  }
  const startTime = getTotalMinutesFromTime(transactionTimeRange.startTime)
  const endTime = getTotalMinutesFromTime(transactionTimeRange.endTime)
  const transactionTime = getTotalMinutesFromTime(
    getHoursAndMinutesFromTimestamp(transactionTimestamp)
  )
  return startTime <= transactionTime && transactionTime <= endTime
}

export function getHoursAndMinutesFromTimestamp(
  timestamp: number
): TimeRangeHourAndMinute {
  const date = new Date(timestamp)
  const utcHours = date.getUTCHours()
  const utcMinutes = date.getUTCMinutes()
  return {
    utcHours,
    utcMinutes,
  }
}

export function getTotalMinutesFromTime(
  timeRange: TimeRangeHourAndMinute
): number {
  return timeRange.utcHours * 60 + timeRange.utcMinutes
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

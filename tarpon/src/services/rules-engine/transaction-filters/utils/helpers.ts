import { isEmpty } from 'lodash'
import {
  TimeRangeHourAndMinute,
  TransactionTimeRange,
} from '../../utils/rule-parameter-schemas'

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

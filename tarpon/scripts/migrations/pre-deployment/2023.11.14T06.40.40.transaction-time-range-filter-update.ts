import { renameRuleFilter } from '../utils/rule'
import { TimeRangeHourAndMinute } from '@/services/rules-engine/utils/rule-parameter-schemas'
import { getHoursAndMinutesFromTimestamp } from '@/services/rules-engine/transaction-filters/transaction-time-range'

export const up = async () => {
  await renameRuleFilter(
    'transactionTimeRange',
    'transactionTimeRange24hr',
    (
      ruleFilter:
        | {
            startTime: number
            endTime: number
          }
        | undefined
    ):
      | {
          startTime: TimeRangeHourAndMinute
          endTime: TimeRangeHourAndMinute
        }
      | undefined => {
      return ruleFilter === undefined
        ? undefined
        : {
            startTime: getHoursAndMinutesFromTimestamp(ruleFilter.startTime),
            endTime: getHoursAndMinutesFromTimestamp(ruleFilter.endTime),
          }
    }
  )
  await renameRuleFilter(
    'transactionTimeRangeHistorical',
    'transactionTimeRangeHistorical24hr',
    (
      ruleFilter:
        | {
            startTime: number
            endTime: number
          }
        | undefined
    ):
      | {
          startTime: TimeRangeHourAndMinute
          endTime: TimeRangeHourAndMinute
        }
      | undefined => {
      return ruleFilter === undefined
        ? undefined
        : {
            startTime: getHoursAndMinutesFromTimestamp(ruleFilter.startTime),
            endTime: getHoursAndMinutesFromTimestamp(ruleFilter.endTime),
          }
    }
  )
}
export const down = async () => {
  // skip
}

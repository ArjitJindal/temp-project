import { renameRuleParameter } from '../utils/rule'
import { TimeWindow } from '@/services/rules-engine/utils/rule-parameter-schemas'

export const up = async () => {
  await renameRuleParameter(
    [
      'multiple-user-senders-within-time-period',
      'multiple-counterparty-senders-within-time-period',
    ],
    [],
    'timePeriodDays',
    'timeWindow',
    (timePeriodDays: number) => ({
      units: timePeriodDays,
      granularity: 'day',
    })
  )
}
export const down = async () => {
  await renameRuleParameter(
    [
      'multiple-user-senders-within-time-period',
      'multiple-counterparty-senders-within-time-period',
    ],
    [],
    'timeWindow',
    'timePeriodDays',
    (timeWindow: TimeWindow) => {
      let units = 1
      if (timeWindow.granularity === 'day') {
        units = 1
      } else if (timeWindow.granularity === 'week') {
        units = 7
      } else if (timeWindow.granularity === 'month') {
        units = 30
      }
      return {
        units,
        granularity: 'day',
      }
    }
  )
}

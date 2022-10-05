import { renameRuleParameter } from '../utils/rule'
import { TimeWindow } from '@/services/rules-engine/utils/rule-parameter-schemas'

export const up = async () => {
  await renameRuleParameter(
    ['high-traffic-between-same-parties'],
    'timeWindowInDays',
    'timeWindow',
    (timeWindowInDays: number) => ({
      units: timeWindowInDays,
      granularity: 'day',
    })
  )
}
export const down = async () => {
  await renameRuleParameter(
    ['high-traffic-between-same-parties'],
    'timeWindow',
    'timeWindowInDays',
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

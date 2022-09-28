import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['high-traffic-between-same-parties'],
    ['timeWindowInDays']
  )
}
export const down = async () => {
  // skip
}

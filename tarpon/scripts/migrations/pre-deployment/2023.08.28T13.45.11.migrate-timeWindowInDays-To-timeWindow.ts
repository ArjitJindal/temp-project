import { renameRuleParameter } from '../utils/rule'
export const up = async () => {
  await renameRuleParameter(
    ['ip-address-multiple-users'],
    [],
    'timeWindowInDays',
    'timeWindow',
    (timeWindowInDays: number) => ({
      units: timeWindowInDays,
      granularity: 'day',
    })
  )
}
export const down = async () => {
  // skip
}

import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    [
      'same-user-using-too-many-cards',
      'too-many-users-for-same-card',
      'sender-location-changes-frequency',
    ],
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

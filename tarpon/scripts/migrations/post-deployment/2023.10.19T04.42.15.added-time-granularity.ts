import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    [
      'same-user-using-too-many-cards',
      'too-many-users-for-same-card',
      'sender-location-changes-frequency',
    ],
    [],
    ['timeWindowInDays']
  )
}
export const down = async () => {
  // skip
}

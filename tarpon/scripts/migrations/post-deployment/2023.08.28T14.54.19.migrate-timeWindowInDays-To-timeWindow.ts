import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['ip-address-multiple-users'],
    [],
    ['timeWindowInDays']
  )
}
export const down = async () => {
  // skip
}

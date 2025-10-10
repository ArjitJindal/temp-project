import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['generic-sanction-screening-user'],
    [],
    ['isActive']
  )
}
export const down = async () => {
  // skip
}

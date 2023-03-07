import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['transactions-velocity'],
    [],
    ['userIdsToCheck']
  )
}
export const down = async () => {
  // skip
}

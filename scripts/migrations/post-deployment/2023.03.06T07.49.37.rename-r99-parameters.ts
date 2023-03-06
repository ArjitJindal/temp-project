import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['user-transaction-limits'],
    [],
    ['threshold', 'timeWindow']
  )
}
export const down = async () => {
  // skip
}

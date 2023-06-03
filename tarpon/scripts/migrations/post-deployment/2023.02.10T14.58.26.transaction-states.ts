import {
  deleteUnusedRuleFilter,
  deleteUnusedRuleParameter,
} from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['high-unsuccessfull-state-rate'],
    [],
    ['transactionState']
  )
  await deleteUnusedRuleFilter(['transactionState'])
}
export const down = async () => {
  // skip
}

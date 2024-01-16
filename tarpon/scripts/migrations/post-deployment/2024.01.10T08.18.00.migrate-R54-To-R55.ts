import { deleteRules, deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['same-user-using-too-many-payment-identifiers'],
    [],
    ['uniqueCardsCountThreshold']
  )
  await deleteRules(['R-54'])
}
export const down = async () => {
  // skip
}

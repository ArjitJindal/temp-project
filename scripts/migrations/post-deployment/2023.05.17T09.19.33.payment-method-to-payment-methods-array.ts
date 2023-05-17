import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter(['paymentMethod'])
}
export const down = async () => {
  // skip
}

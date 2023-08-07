import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter(['productType'])
}
export const down = async () => {
  // skip
}

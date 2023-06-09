import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter(['paymentMethodHistorical'])
}
export const down = async () => {
  // skip
}

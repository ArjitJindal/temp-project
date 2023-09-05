import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter(['transactionCountries', 'paymentFilters'])
}
export const down = async () => {
  // skip
}

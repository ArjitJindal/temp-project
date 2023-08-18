import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    [
      'transactions-average-amount-exceeded',
      'transactions-average-daily-amount-exceeded',
      'transactions-average-number-exceeded',
    ],
    [],
    ['averageThreshold']
  )
}
export const down = async () => {
  // skip
}

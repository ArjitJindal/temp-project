import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    [
      'transactions-average-amount-exceeded',
      'transactions-average-daily-amount-exceeded',
      'transactions-average-number-exceeded',
    ],
    [],
    'averageThreshold',
    'valueThresholdPeriod1',
    (value) => value
  )
}
export const down = async () => {
  // skip
}

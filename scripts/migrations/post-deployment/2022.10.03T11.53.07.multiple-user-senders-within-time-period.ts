import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    [
      'multiple-user-senders-within-time-period',
      'multiple-counterparty-senders-within-time-period',
    ],
    ['timePeriodDays']
  )
}
export const down = async () => {
  // skip
}

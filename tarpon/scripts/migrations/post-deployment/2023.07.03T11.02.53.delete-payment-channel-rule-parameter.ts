import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    [
      'transactions-velocity',
      'low-value-outgoing-transactions',
      'low-value-incoming-transactions',
      'transaction-amount',
      'transaction-new-country',
    ],
    [],
    ['paymentChannel']
  )
}
export const down = async () => {
  // skip
}

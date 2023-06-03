import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['transactions-velocity', 'transactions-volume'],
    [],
    ['matchPaymentMethodDetails']
  )
}
export const down = async () => {
  // skip
}

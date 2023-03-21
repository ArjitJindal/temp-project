import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['transactions-velocity', 'transactions-volume'],
    [],
    'matchPaymentMethodDetails',
    'originMatchPaymentMethodDetails',
    (value: boolean) => value
  )
}
export const down = async () => {
  // skip
}

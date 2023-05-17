import { renameRuleParameter } from '../utils/rule'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

export const up = async () => {
  await renameRuleParameter(
    undefined,
    [],
    'paymentMethod',
    'paymentMethods',
    (paymentMethod: PaymentMethod) => [paymentMethod]
  )
}

export const down = async () => {
  // skip
}

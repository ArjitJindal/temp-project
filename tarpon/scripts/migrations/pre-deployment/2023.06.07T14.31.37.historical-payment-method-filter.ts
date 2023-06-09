import { renameRuleFilter } from '../utils/rule'

import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'

export const up = async () => {
  await renameRuleFilter(
    'paymentMethodHistorical',
    'paymentMethodsHistorical',
    (paymentMethod: PaymentMethod) => [paymentMethod]
  )
}
export const down = async () => {
  // skip
}

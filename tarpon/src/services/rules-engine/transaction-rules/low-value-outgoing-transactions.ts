import LowValueTransactionsRule from './low-value-transactions-base'
import { traceable } from '@/core/xray'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'

@traceable
export default class LowValueOutgoingTransactionsRule extends LowValueTransactionsRule {
  protected getDirection(): PaymentDirection {
    return 'sending'
  }
}

import LowValueTransactionsRule from './low-value-transactions-base'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'

export default class LowValueIncomingTransactionsRule extends LowValueTransactionsRule {
  protected getDirection(): PaymentDirection {
    return 'receiving'
  }
}

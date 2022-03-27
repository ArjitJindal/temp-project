import { PaymentDirection } from '../../../@types/tranasction/payment-direction'
import LowValueTransactionsRule from './low-value-transactions-base'

export default class LowValueOutgoingTransactionsRule extends LowValueTransactionsRule {
  protected getDirection(): PaymentDirection {
    return 'sending'
  }
}

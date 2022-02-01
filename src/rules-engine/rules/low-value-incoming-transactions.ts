import { PaymentDirection } from '../../@types/tranasction/payment-direction'
import LowValueTransactionsRule from './low-value-transactions-base'
import { RuleInfo } from './rule'

export default class LowValueIncomingTransactionsRule extends LowValueTransactionsRule {
  public getInfo(): RuleInfo {
    return {
      name: 'low_value_incoming_transactions',
      displayName: 'Low value incoming transactions',
      description:
        '<= x number of low value incoming transactions just below a specific threshold y to a customer',
    }
  }

  protected getDirection(): PaymentDirection {
    return 'receiving'
  }
}

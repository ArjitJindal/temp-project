import LowValueTransactionsRule from './low-value-transactions-base'
import { RuleInfo } from './rule'

export default class LowValueOutgoingTransactionsRule extends LowValueTransactionsRule {
  public getInfo(): RuleInfo {
    return {
      name: 'low_value_outgoing_transactions',
      displayName: 'Low value outgoing transactions',
      description:
        '<= x number of low value outgoing transactions just below a specific threshold y from a customer',
    }
  }
  protected getDirection(): 'sending' | 'receiving' {
    return 'sending'
  }
}

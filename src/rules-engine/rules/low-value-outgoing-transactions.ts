import { PaymentDirection } from '../../@types/tranasction/payment-direction'
import LowValueTransactionsRule from './low-value-transactions-base'
import { RuleInfo } from './rule'

export default class LowValueOutgoingTransactionsRule extends LowValueTransactionsRule {
  public getInfo(): RuleInfo {
    return {
      name: 'low_value_outgoing_transactions',
      displayName:
        '>= x number of low value outgoing transactions just below a specific threshold y from a customer',
      description:
        '>= x number of low value outgoing transactions just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
    }
  }
  protected getDirection(): PaymentDirection {
    return 'sending'
  }
}

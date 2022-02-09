import { PaymentDirection } from '../../@types/tranasction/payment-direction'
import LowValueTransactionsRule from './low-value-transactions-base'
import { RuleInfo } from './rule'

export default class LowValueIncomingTransactionsRule extends LowValueTransactionsRule {
  public getInfo(): RuleInfo {
    return {
      name: 'low_value_incoming_transactions',
      displayName:
        '>= x number of low value incoming transactions just below a specific threshold y to a customer',
      description:
        '>= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
    }
  }

  protected getDirection(): PaymentDirection {
    return 'receiving'
  }
}

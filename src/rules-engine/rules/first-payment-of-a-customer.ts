import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule, RuleInfo, RuleParameters } from './rule'

type FirstPaymentOfACustomerRuleParameters = RuleParameters & {}

export default class FirstPaymentOfACustomerRule extends Rule<FirstPaymentOfACustomerRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'first_payment_of_a_customer',
      displayName: 'First payment of a customer',
      description: 'A customer is making a transaction for the first time',
    }
  }

  public async computeRule() {
    const transactionRepository = new TransactionRepository(
      this.tenantId,
      this.dynamoDb
    )
    const isFirstPayment = !(await transactionRepository.hasAnyTransaction(
      this.transaction.senderUserId
    ))
    if (isFirstPayment) {
      return {
        action: this.parameters.action,
      }
    }
  }
}

import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule, RuleInfo, RuleParameters } from './rule'

type FirstPaymentRuleParameters = RuleParameters & {}

export default class FirstPaymentRule extends Rule<FirstPaymentRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'first_payment',
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

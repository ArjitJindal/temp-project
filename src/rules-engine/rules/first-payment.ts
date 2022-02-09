import { RuleParameters } from '../../@types/rule/rule-instance'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule, RuleInfo } from './rule'

type FirstPaymentRuleParameters = RuleParameters

export default class FirstPaymentRule extends Rule<FirstPaymentRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'first_payment',
      displayName: 'First payment of a Customer',
      description:
        'First transaction of a user. If you activate this rule, users will be suspended when they make their first transaction.',
    }
  }

  public async computeRule() {
    const transactionRepository = new TransactionRepository(
      this.tenantId,
      this.dynamoDb
    )
    const isFirstPayment =
      this.transaction.senderUserId &&
      !(await transactionRepository.hasAnySendingTransaction(
        this.transaction.senderUserId
      ))
    if (isFirstPayment) {
      return {
        action: this.parameters.action,
      }
    }
  }
}

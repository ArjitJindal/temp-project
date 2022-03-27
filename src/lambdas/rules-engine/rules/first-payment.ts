import { RuleParameters } from '../../../@types/rule/rule-instance'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'

type FirstPaymentRuleParameters = RuleParameters

export default class FirstPaymentRule extends Rule<FirstPaymentRuleParameters> {
  public async computeRule() {
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
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

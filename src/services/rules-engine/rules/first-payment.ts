import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'

export default class FirstPaymentRule extends Rule<unknown> {
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
        action: this.action,
      }
    }
  }
}

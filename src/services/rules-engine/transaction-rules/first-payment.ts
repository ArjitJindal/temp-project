import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionRule } from './rule'

export default class FirstPaymentRule extends TransactionRule<any> {
  public static getSchema(): any {
    return {}
  }

  public async computeRule() {
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const isFirstPayment =
      this.transaction.originUserId &&
      !(await transactionRepository.hasAnySendingTransaction(
        this.transaction.originUserId
      ))
    if (isFirstPayment) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
  }
}

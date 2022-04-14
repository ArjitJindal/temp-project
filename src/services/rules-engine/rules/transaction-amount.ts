import { Rule } from './rule'
import { isTransactionAmountAboveThreshold } from './utils/transaction-rule-utils'
import { isUserBetweenAge } from './utils/user-rule-utils'

export type AgeTransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange?: {
    minAge: number
    maxAge: number
  }
}

export default class AgeTransactionAmountRule extends Rule<AgeTransactionAmountRuleParameters> {
  public getFilters() {
    const { ageRange } = this.parameters
    return [() => isUserBetweenAge(this.senderUser, ageRange)]
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters
    if (
      await isTransactionAmountAboveThreshold(
        this.transaction.sendingAmountDetails,
        transactionAmountThreshold
      )
    ) {
      return { action: this.action }
    }
  }
}

import { Rule } from './rule'
import { isTransactionAmountAboveThreshold } from './utils/transaction-rule-utils'
import { isConsumerUser, isUserBetweenAge } from './utils/user-rule-utils'
import { User } from '@/@types/openapi-public/User'

export type AgeTransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
  ageRange: {
    minAge: number
    maxAge: number
  }
}

export default class AgeTransactionAmountRule extends Rule<AgeTransactionAmountRuleParameters> {
  public async computeRule() {
    const { transactionAmountThreshold, ageRange } = this.parameters
    if (
      !this.transaction.sendingAmountDetails ||
      !this.senderUser ||
      !isConsumerUser(this.senderUser)
    ) {
      return
    }
    const senderUser = this.senderUser as User

    if (
      (await isTransactionAmountAboveThreshold(
        this.transaction.sendingAmountDetails,
        transactionAmountThreshold
      )) &&
      isUserBetweenAge(senderUser, ageRange)
    ) {
      return { action: this.action }
    }
  }
}

import { mapValues, uniqBy } from 'lodash'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { PaymentDetailsScreeningRuleBase } from './payment-details-screening-base'
import { traceable } from '@/core/xray'
@traceable
export class PaymentDetailsScreeningRule extends PaymentDetailsScreeningRuleBase {
  public async computeRule() {
    const hitRules: RuleHitResult = []

    const isThresholdHit = this.parameters?.transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          mapValues(
            this.parameters.transactionAmountThreshold,
            (threshold) => ({
              min: threshold,
            })
          )
        )
      : true

    if (!isThresholdHit) {
      return hitRules
    }

    if (!this.senderUser && this.transaction.originPaymentDetails) {
      const sanctionsDetails = await this.checkCounterPartyTransaction(
        this.transaction.originPaymentDetails
      )
      if (sanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
          sanctionsDetails: uniqBy(sanctionsDetails, (detail) => detail.name),
        })
      }
    }

    if (!this.receiverUser && this.transaction.destinationPaymentDetails) {
      const sanctionsDetails = await this.checkCounterPartyTransaction(
        this.transaction.destinationPaymentDetails
      )
      if (sanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
          sanctionsDetails: uniqBy(sanctionsDetails, (detail) => detail.name),
        })
      }
    }

    return hitRules
  }
}

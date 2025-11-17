import mapValues from 'lodash/mapValues'
import uniqBy from 'lodash/uniqBy'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { PaymentDetailsScreeningRuleBase } from './payment-details-screening-base'
import { traceable } from '@/core/xray'
import { RuleExecutionSanctionsDetails } from '@/@types/openapi-internal/all'
@traceable
export class SanctionsCounterPartyRule extends PaymentDetailsScreeningRuleBase {
  public async computeRule() {
    const hitRules: RuleHitResult = []

    const hasUser = this.senderUser || this.receiverUser
    if (!hasUser) {
      return {
        ruleHitResult: hitRules,
      }
    }

    if (this.senderUser && this.receiverUser) {
      return {
        ruleHitResult: hitRules,
      }
    }

    if (!this.parameters.ruleStages.includes(this.stage)) {
      return {
        ruleHitResult: hitRules,
      }
    }

    const isThresholdHit = this.parameters?.transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          mapValues(
            this.parameters.transactionAmountThreshold,
            (threshold) => ({
              min: threshold,
            })
          ),
          this.dynamoDb
        )
      : true

    if (!isThresholdHit) {
      return {
        ruleHitResult: hitRules,
      }
    }
    let originRuleExecutionResult: RuleExecutionSanctionsDetails[] = []
    if (!this.senderUser && this.transaction.originPaymentDetails) {
      const { ruleHitSanctionsDetails, ruleExecutionSanctionsDetails } =
        await this.checkCounterPartyTransaction(
          this.transaction.originPaymentDetails,
          this.receiverUser
        )
      originRuleExecutionResult = ruleExecutionSanctionsDetails ?? []

      if (ruleHitSanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
          sanctionsDetails: uniqBy(
            ruleHitSanctionsDetails,
            (detail) => detail.name
          ),
        })
      }
    }
    let destinationRuleExecutionResult: RuleExecutionSanctionsDetails[] = []
    if (!this.receiverUser && this.transaction.destinationPaymentDetails) {
      const { ruleHitSanctionsDetails, ruleExecutionSanctionsDetails } =
        await this.checkCounterPartyTransaction(
          this.transaction.destinationPaymentDetails,
          this.senderUser
        )
      destinationRuleExecutionResult = ruleExecutionSanctionsDetails ?? []

      if (ruleHitSanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
          sanctionsDetails: uniqBy(
            ruleHitSanctionsDetails,
            (detail) => detail.name
          ),
        })
      }
    }

    return {
      ruleHitResult: hitRules,
      ruleExecutionResult: {
        sanctionsDetails: [
          ...originRuleExecutionResult,
          ...destinationRuleExecutionResult,
        ],
      },
    }
  }
}

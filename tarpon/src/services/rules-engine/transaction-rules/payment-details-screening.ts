import mapValues from 'lodash/mapValues'
import uniqBy from 'lodash/uniqBy'
import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import {
  PaymentDetailsScreeningRuleBase,
  PaymentDetailsScreeningRuleParameters,
} from './payment-details-screening-base'
import { traceable } from '@/core/xray'
import { RuleExecutionSanctionsDetails } from '@/@types/openapi-internal/RuleExecutionSanctionsDetails'
@traceable
export class PaymentDetailsScreeningRule extends PaymentDetailsScreeningRuleBase {
  public static getSchema(): JSONSchemaType<PaymentDetailsScreeningRuleParameters> {
    const baseSchema = PaymentDetailsScreeningRuleBase.getSchema()
    return {
      ...baseSchema,
    }
  }

  public async computeRule() {
    const hitRules: RuleHitResult = []

    if (this.senderUser || this.receiverUser) {
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
    if (this.transaction.originPaymentDetails) {
      const { ruleHitSanctionsDetails, ruleExecutionSanctionsDetails } =
        await this.checkCounterPartyTransaction(
          this.transaction.originPaymentDetails
        )
      originRuleExecutionResult = ruleExecutionSanctionsDetails ?? []
      if (ruleHitSanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
          sanctionsDetails: uniqBy(
            ruleHitSanctionsDetails,
            (detail) => detail.name
          ).map((detail) => ({
            ...detail,
            hitDirection: 'ORIGIN',
          })),
        })
      }
    }
    let destinationRuleExecutionResult: RuleExecutionSanctionsDetails[] = []
    if (this.transaction.destinationPaymentDetails) {
      const { ruleHitSanctionsDetails, ruleExecutionSanctionsDetails } =
        await this.checkCounterPartyTransaction(
          this.transaction.destinationPaymentDetails
        )
      destinationRuleExecutionResult = ruleExecutionSanctionsDetails ?? []
      if (ruleHitSanctionsDetails.length > 0) {
        hitRules.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
          sanctionsDetails: uniqBy(
            ruleHitSanctionsDetails,
            (detail) => detail.name
          ).map((detail) => ({
            ...detail,
            hitDirection: 'DESTINATION',
          })),
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

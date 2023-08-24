import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { mapValues } from 'lodash'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'

import { TransactionRule } from './rule'

export type FirstPaymentRuleParameter = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
}

export default class FirstPaymentRule extends TransactionRule<
  FirstPaymentRuleParameter,
  TransactionHistoricalFilters
> {
  public static getSchema(): JSONSchemaType<FirstPaymentRuleParameter> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA(),
      },
      required: [],
    }
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters
    const thresholdHit = transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          mapValues(transactionAmountThreshold, (threshold) => ({
            min: threshold,
          }))
        )
      : true
    const isFirstPayment =
      this.transaction.originUserId &&
      !(await this.transactionRepository.hasAnySendingTransaction(
        this.transaction.originUserId,
        {
          originCountries: this.filters.transactionCountriesHistorical,
        }
      ))

    const hitResult: RuleHitResult = []
    if (thresholdHit && isFirstPayment) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
    }
    return hitResult
  }
}

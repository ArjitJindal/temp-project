import { JSONSchemaType } from 'ajv'
import { mapValues } from 'lodash'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters, TransactionFilters } from '../filters'
import { TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'

import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type FirstPaymentRuleParameter = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
}

@traceable
export default class FirstPaymentRule extends TransactionRule<
  FirstPaymentRuleParameter,
  TransactionHistoricalFilters & TransactionFilters
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
          })),
          this.dynamoDb
        )
      : true
    const isFirstPayment =
      this.transaction.originUserId &&
      !(await this.transactionRepository.hasAnySendingTransaction(
        this.transaction.originUserId,
        {
          originCountries:
            this.filters.transactionCountriesHistorical ??
            this.filters.originTransactionCountries,
          transactionAmountRange:
            this.filters.transactionAmountRangeHistorical ??
            this.filters.transactionAmountRange,
          originPaymentMethods: this.filters.paymentMethodsHistorical,
          transactionTimeRange24hr:
            this.filters.transactionTimeRangeHistorical24hr ??
            this.filters.transactionTimeRange24hr,
          transactionStates:
            this.filters.transactionStatesHistorical ??
            this.filters.transactionStates,
          transactionTypes:
            this.filters.transactionTypesHistorical ??
            this.filters.transactionTypes,
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

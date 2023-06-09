import { JSONSchemaType } from 'ajv'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends TransactionRule<
  FirstActivityAfterLongTimeRuleParameters,
  TransactionHistoricalFilters
> {
  public static getSchema(): JSONSchemaType<FirstActivityAfterLongTimeRuleParameters> {
    return {
      type: 'object',
      properties: {
        dormancyPeriodDays: {
          type: 'integer',
          title: 'Dormancy period threshold (days)',
        },
      },
      required: ['dormancyPeriodDays'],
    }
  }

  public async computeRule() {
    if (!this.senderUser) {
      return
    }

    const { dormancyPeriodDays } = this.parameters

    const lastSendingTransaction =
      this.senderUser?.userId &&
      (
        await this.transactionRepository.getLastNUserSendingTransactions(
          this.senderUser?.userId,
          1,
          {
            transactionStates: this.filters.transactionStatesHistorical,
            transactionTypes: this.filters.transactionTypesHistorical,
            transactionAmountRange:
              this.filters.transactionAmountRangeHistorical,
            originPaymentMethods: this.filters.paymentMethodsHistorical,
            originCountries: this.filters.transactionCountriesHistorical,
          },
          ['timestamp']
        )
      )[0]

    const hitResult: RuleHitResult = []
    if (lastSendingTransaction) {
      if (
        dayjs(this.transaction.timestamp).diff(
          lastSendingTransaction.timestamp,
          'day'
        ) > dormancyPeriodDays
      ) {
        hitResult.push({ direction: 'ORIGIN', vars: {} })
      }
    }
    return hitResult
  }
}

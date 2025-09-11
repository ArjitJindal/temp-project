import { JSONSchemaType } from 'ajv'
import maxBy from 'lodash/maxBy'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'

export type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
  checkDirection?: 'sending' | 'all'
}

@traceable
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
        checkDirection: {
          type: 'string',
          title: 'Transaction history scope options',
          description:
            "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions",
          enum: ['sending', 'all'],
          nullable: true,
        },
      },
      required: ['dormancyPeriodDays'],
    }
  }

  public async computeRule() {
    const { dormancyPeriodDays } = this.parameters
    const checkDirection = this.parameters.checkDirection ?? 'all'
    if (!this.senderUser) {
      return
    }

    const filters = {
      transactionStates: this.filters.transactionStatesHistorical,
      transactionTypes: this.filters.transactionTypesHistorical,
      transactionAmountRange: this.filters.transactionAmountRangeHistorical,
      originPaymentMethods: this.filters.paymentMethodsHistorical,
      originCountries: this.filters.transactionCountriesHistorical,
    }
    const lastSendingTransaction = (
      await this.transactionRepository.getLastNUserSendingTransactions(
        this.senderUser.userId,
        1,
        filters,
        ['timestamp']
      )
    )[0]
    const lastReceivingTransaction =
      checkDirection !== 'sending'
        ? (
            await this.transactionRepository.getLastNUserReceivingTransactions(
              this.senderUser.userId,
              1,
              filters,
              ['timestamp']
            )
          )[0]
        : undefined
    const latestTransaction = maxBy(
      [lastSendingTransaction, lastReceivingTransaction].filter(Boolean),
      (t) => t?.timestamp
    )

    const hitResult: RuleHitResult = []
    if (latestTransaction) {
      const diffDays = dayjs(this.transaction.timestamp).diff(
        latestTransaction.timestamp,
        'day'
      )

      if (diffDays > dormancyPeriodDays) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: {},
        })
      }
    }
    return hitResult
  }
}

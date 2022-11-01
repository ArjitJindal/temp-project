import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionFilters } from '../transaction-filters'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends TransactionRule<
  FirstActivityAfterLongTimeRuleParameters,
  TransactionFilters
> {
  public static getSchema(): JSONSchemaType<FirstActivityAfterLongTimeRuleParameters> {
    return {
      type: 'object',
      properties: {
        dormancyPeriodDays: {
          type: 'integer',
          title: 'Dormancy Period Threshold (Days)',
        },
      },
      required: ['dormancyPeriodDays'],
    }
  }

  public async computeRule() {
    const { dormancyPeriodDays } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastSendingTransaction =
      this.transaction.originUserId &&
      (
        await transactionRepository.getLastNUserSendingTransactions(
          this.transaction.originUserId,
          1,
          {
            transactionState: this.filters.transactionState,
            transactionTypes: this.filters.transactionTypes,
            originPaymentMethod: this.filters.paymentMethod,
          },
          ['timestamp']
        )
      )[0]
    if (lastSendingTransaction) {
      if (
        dayjs(this.transaction.timestamp).diff(
          lastSendingTransaction.timestamp,
          'day'
        ) > dormancyPeriodDays
      ) {
        return { action: this.action }
      }
    }
  }
}

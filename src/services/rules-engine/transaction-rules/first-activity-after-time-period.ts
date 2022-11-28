import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionFilters } from '../transaction-filters'
import { RuleHitResult } from '../rule'
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
    if (!this.senderUser) {
      return
    }

    const { dormancyPeriodDays } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastSendingTransaction =
      this.senderUser?.userId &&
      (
        await transactionRepository.getLastNUserSendingTransactions(
          this.senderUser?.userId,
          1,
          {
            transactionState: this.filters.transactionState,
            transactionTypes: this.filters.transactionTypes,
            originPaymentMethod: this.filters.paymentMethod,
            originCountries: this.filters.transactionCountries,
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

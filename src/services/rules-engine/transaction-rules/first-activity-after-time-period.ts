import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionRule } from './rule'

export type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends TransactionRule<FirstActivityAfterLongTimeRuleParameters> {
  public static getSchema(): JSONSchemaType<FirstActivityAfterLongTimeRuleParameters> {
    return {
      type: 'object',
      properties: {
        dormancyPeriodDays: { type: 'integer' },
      },
      required: ['dormancyPeriodDays'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastSendingThinTransaction =
      this.transaction.originUserId &&
      (
        await transactionRepository.getLastNUserSendingThinTransactions(
          this.transaction.originUserId,
          1
        )
      )[0]
    if (lastSendingThinTransaction) {
      if (
        dayjs(this.transaction.timestamp).diff(
          lastSendingThinTransaction.timestamp,
          'day'
        ) > this.parameters.dormancyPeriodDays
      ) {
        return { action: this.action }
      }
    }
  }
}

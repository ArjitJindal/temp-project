import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'

type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends Rule<FirstActivityAfterLongTimeRuleParameters> {
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
      this.transaction.senderUserId &&
      (
        await transactionRepository.getLastNUserSendingThinTransactions(
          this.transaction.senderUserId,
          1
        )
      )[0]
    if (lastSendingThinTransaction) {
      if (
        dayjs
          .unix(this.transaction.timestamp)
          .diff(lastSendingThinTransaction.timestamp, 'day') >
        this.parameters.dormancyPeriodDays
      ) {
        return { action: this.action }
      }
    }
  }
}

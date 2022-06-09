import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'

export type FirstActivityAfterLongTimeRuleParameters =
  DefaultTransactionRuleParameters & {
    dormancyPeriodDays: number
  }

export default class FirstActivityAfterLongTimeRule extends TransactionRule<FirstActivityAfterLongTimeRuleParameters> {
  public static getSchema(): JSONSchemaType<FirstActivityAfterLongTimeRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        dormancyPeriodDays: {
          type: 'integer',
          title: 'Dormancy Period Threshold (Days)',
        },
      },
      required: ['dormancyPeriodDays'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { dormancyPeriodDays, transactionState } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastSendingThinTransaction =
      this.transaction.originUserId &&
      (
        await transactionRepository.getLastNUserSendingThinTransactions(
          this.transaction.originUserId,
          1,
          { transactionState }
        )
      )[0]
    if (lastSendingThinTransaction) {
      if (
        dayjs(this.transaction.timestamp).diff(
          lastSendingThinTransaction.timestamp,
          'day'
        ) > dormancyPeriodDays
      ) {
        return { action: this.action }
      }
    }
  }
}

import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isUserType } from '../utils/user-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { UserType } from '@/@types/user/user-type'
import dayjs from '@/utils/dayjs'

export type FirstActivityAfterLongTimeRuleParameters =
  DefaultTransactionRuleParameters & {
    dormancyPeriodDays: number
    // optional parameter
    userType?: UserType
  }

export default class FirstActivityAfterLongTimeRule extends TransactionRule<FirstActivityAfterLongTimeRuleParameters> {
  public static getSchema(): JSONSchemaType<FirstActivityAfterLongTimeRuleParameters> {
    return {
      type: 'object',
      properties: {
        dormancyPeriodDays: {
          type: 'integer',
          title: 'Dormancy Period Threshold (Days)',
        },
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
      },
      required: ['dormancyPeriodDays'],
    }
  }

  public getFilters() {
    const { userType } = this.parameters
    return [() => isUserType(this.senderUser, userType)]
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

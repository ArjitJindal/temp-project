import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type SameUserUsingTooManyCardsParameters = {
  uniqueUsersCountThreshold: number
  timeWindowInDays: number
}

export default class SameUserUsingTooManyCardsRule extends TransactionRule<SameUserUsingTooManyCardsParameters> {
  public static getSchema(): JSONSchemaType<SameUserUsingTooManyCardsParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users Count Threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueUsersCountThreshold', 'timeWindowInDays'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [
      () => this.transaction.originPaymentDetails?.method === 'CARD',
      () => this.transaction.originUserId !== undefined,
    ]
  }

  public async computeRule() {
    const { uniqueUsersCountThreshold, timeWindowInDays } = this.parameters
    if (
      uniqueUsersCountThreshold === undefined ||
      timeWindowInDays === undefined
    ) {
      throw new MissingRuleParameter()
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const thinTransactionsFromUser =
      await transactionRepository.getUserSendingThinTransactions(
        this.transaction.originUserId!,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        }
      )
    const transactions = await transactionRepository.getTransactionsByIds(
      thinTransactionsFromUser.map((transaction) => transaction.transactionId)
    )
    const uniqueCardsCount = new Set(
      transactions
        .map(
          (transaction) =>
            (transaction?.originPaymentDetails as CardDetails)?.cardFingerprint
        )
        .concat(
          (this.transaction?.originPaymentDetails as CardDetails)
            .cardFingerprint
        )
    ).size
    if (uniqueCardsCount > uniqueUsersCountThreshold) {
      return {
        action: this.action,
      }
    }
  }
}

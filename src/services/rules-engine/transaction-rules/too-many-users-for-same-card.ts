import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getSenderKeys } from '../utils'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type TooManyUsersForSameCardParameters = {
  uniqueUsersCountThreshold: number
  timeWindowInDays: number
}

export default class TooManyUsersForSameCardRule extends TransactionRule<TooManyUsersForSameCardParameters> {
  public static getSchema(): JSONSchemaType<TooManyUsersForSameCardParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users Count Threshold',
          description:
            'rule is run when the users count per time window is greater than the threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueUsersCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    if (this.transaction.originPaymentDetails?.method !== 'CARD') {
      return
    }

    const { uniqueUsersCountThreshold, timeWindowInDays } = this.parameters
    const cardUser = this.transaction.originPaymentDetails?.method
    if (
      uniqueUsersCountThreshold === undefined ||
      timeWindowInDays === undefined
    ) {
      throw new MissingRuleParameter()
    }

    const senderKeyId = getSenderKeys(
      this.tenantId,
      this.transaction
    )?.PartitionKeyID

    if (!senderKeyId || !cardUser) {
      return
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const transactionsFromCard =
      await transactionRepository.getNonUserSendingTransactions(
        this.transaction.originPaymentDetails as CardDetails,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        {},
        ['originUserId']
      )
    const uniqueUserCount = new Set(
      transactionsFromCard
        .map((transaction) => transaction.originUserId)
        .concat(this.transaction.originUserId)
        .filter(Boolean)
    ).size
    if (uniqueUserCount > uniqueUsersCountThreshold) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          cardFingerprint: (
            this.transaction.originPaymentDetails as CardDetails
          ).cardFingerprint,
          uniqueUserCount,
        },
      }
    }
  }
}

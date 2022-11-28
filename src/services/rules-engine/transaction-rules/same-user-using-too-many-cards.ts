import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { RuleHitResult } from '../rule'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type SameUserUsingTooManyCardsParameters = {
  uniqueCardsCountThreshold: number
  timeWindowInDays: number
}

export default class SameUserUsingTooManyCardsRule extends TransactionRule<SameUserUsingTooManyCardsParameters> {
  public static getSchema(): JSONSchemaType<SameUserUsingTooManyCardsParameters> {
    return {
      type: 'object',
      properties: {
        uniqueCardsCountThreshold: {
          type: 'integer',
          title: 'Cards Count Threshold',
          description:
            'rule is run when the cards count per time window is greater than the threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueCardsCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    if (
      !this.transaction.originUserId ||
      this.transaction.originPaymentDetails?.method !== 'CARD'
    ) {
      return
    }

    const { uniqueCardsCountThreshold, timeWindowInDays } = this.parameters
    if (
      uniqueCardsCountThreshold === undefined ||
      timeWindowInDays === undefined
    ) {
      throw new MissingRuleParameter()
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const transactions = await transactionRepository.getUserSendingTransactions(
      this.transaction.originUserId!,
      {
        afterTimestamp: dayjs(this.transaction.timestamp)
          .subtract(timeWindowInDays, 'day')
          .valueOf(),
        beforeTimestamp: this.transaction.timestamp!,
      },
      {},
      ['originPaymentDetails']
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

    const hitResult: RuleHitResult = []
    if (uniqueCardsCount > uniqueCardsCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          uniqueCardsCount,
        },
      })
    }
    return hitResult
  }
}

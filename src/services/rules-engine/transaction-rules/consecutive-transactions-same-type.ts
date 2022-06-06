import _ from 'lodash'
import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionRule } from './rule'

export type ConsecutiveTransactionSameTypeRuleParameters = {
  targetTransactionsThreshold: number
  targetTransactionType: string
  otherTransactionTypes: string[]
  timeWindowInDays: number
}

export default class ConsecutiveTransactionsameTypeRule extends TransactionRule<ConsecutiveTransactionSameTypeRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<ConsecutiveTransactionSameTypeRuleParameters> {
    return {
      type: 'object',
      properties: {
        targetTransactionsThreshold: {
          type: 'integer',
          title: 'Transactions Count Threshold',
        },
        targetTransactionType: {
          type: 'string',
          title: 'Target Transaction Type',
        },
        otherTransactionTypes: {
          type: 'array',
          title: 'Other Transaction Types',
          items: {
            type: 'string',
          },
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: [
        'targetTransactionsThreshold',
        'targetTransactionType',
        'otherTransactionTypes',
        'timeWindowInDays',
      ],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { targetTransactionType } = this.parameters
    return [
      () => this.transaction.type === targetTransactionType,
      () => this.transaction.originUserId !== undefined,
    ]
  }

  public async computeRule() {
    const {
      targetTransactionType,
      otherTransactionTypes,
      targetTransactionsThreshold,
      timeWindowInDays,
    } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const [targetTransactions, ...otherTransactionsList] = await Promise.all([
      transactionRepository.getLastNUserSendingThinTransactions(
        this.transaction.originUserId as string,
        targetTransactionsThreshold,
        targetTransactionType
      ),
      ...(otherTransactionTypes || []).map((transactionType) =>
        transactionRepository.getLastNUserSendingThinTransactions(
          this.transaction.originUserId as string,
          1,
          transactionType
        )
      ),
    ])

    const afterTimestamp = dayjs(this.transaction.timestamp).subtract(
      timeWindowInDays,
      'day'
    )
    const filteredTargetTransactions = targetTransactions.filter(
      (transaction) => dayjs(transaction.timestamp) > afterTimestamp
    )
    const lastOtherTransaction = _.last(
      _.sortBy(
        otherTransactionsList
          .map((otherTransactions) => otherTransactions[0])
          .filter(Boolean),
        'timestamp'
      ).filter((transaction) => dayjs(transaction.timestamp) > afterTimestamp)
    )

    const lastTargetTransactionTimestamp = _.last(
      filteredTargetTransactions
    )?.timestamp
    const lastTransactionTimestamp = lastOtherTransaction?.timestamp
    if (
      filteredTargetTransactions.length + 1 > targetTransactionsThreshold &&
      (!lastTransactionTimestamp ||
        (lastTargetTransactionTimestamp &&
          lastTransactionTimestamp < lastTargetTransactionTimestamp))
    ) {
      return {
        action: this.action,
      }
    }
  }
}

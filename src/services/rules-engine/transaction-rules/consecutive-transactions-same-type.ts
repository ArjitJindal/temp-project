import _ from 'lodash'
import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import {
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TRANSACTION_TYPES_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export type ConsecutiveTransactionSameTypeRuleParameters =
  DefaultTransactionRuleParameters & {
    targetTransactionsThreshold: number
    transactionTypes: TransactionType[]
    otherTransactionTypes: TransactionType[]
    timeWindowInDays: number
  }

export default class ConsecutiveTransactionsameTypeRule extends TransactionRule<ConsecutiveTransactionSameTypeRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<ConsecutiveTransactionSameTypeRuleParameters> {
    return {
      type: 'object',
      properties: {
        targetTransactionsThreshold: TRANSACTIONS_THRESHOLD_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_SCHEMA({
          title: 'Target Transaction Types',
        }),
        otherTransactionTypes: TRANSACTION_TYPES_SCHEMA({
          title: 'Other Transaction Types',
        }),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: [
        'targetTransactionsThreshold',
        'transactionTypes',
        'otherTransactionTypes',
        'timeWindowInDays',
      ],
    }
  }

  public getFilters() {
    const { transactionTypes } = this.parameters
    return super
      .getFilters()
      .concat([
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
        () => this.transaction.originUserId !== undefined,
      ])
  }

  public async computeRule() {
    const {
      transactionTypes,
      otherTransactionTypes,
      targetTransactionsThreshold,
      timeWindowInDays,
      transactionState,
    } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const [targetTransactions, ...otherTransactionsList] = await Promise.all([
      transactionRepository.getLastNUserSendingTransactions(
        this.transaction.originUserId as string,
        targetTransactionsThreshold,
        { transactionTypes: transactionTypes, transactionState },
        ['timestamp']
      ),
      transactionRepository.getLastNUserSendingTransactions(
        this.transaction.originUserId as string,
        1,
        { transactionTypes: otherTransactionTypes, transactionState },
        ['timestamp']
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
        vars: {
          ...super.getTransactionVars('origin'),
        },
      }
    }
  }
}

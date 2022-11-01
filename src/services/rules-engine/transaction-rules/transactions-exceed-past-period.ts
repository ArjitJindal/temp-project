import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getTransactionUserPastTransactionsCount } from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import { TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'

export type TransactionsExceedPastPeriodRuleParameters = {
  minTransactionsInTimeWindow1?: number
  multiplierThreshold: number
  timeWindow1: TimeWindow
  timeWindow2: TimeWindow

  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
}

export default class TransactionsExceedPastPeriodRule extends TransactionRule<
  TransactionsExceedPastPeriodRuleParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsExceedPastPeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow1: TIME_WINDOW_SCHEMA({
          title: 'Time Period 1',
        }),
        timeWindow2: TIME_WINDOW_SCHEMA({
          title: 'Time Period 2',
          description:
            'Should be larger than time period 1. Time period 1 is excluded',
        }),
        multiplierThreshold: {
          type: 'integer',
          title: 'Multiplier threshold',
          description:
            'rule is run when the number of transactions of time period 2 is greater than the number of transactions of time period 1 multiplied by this threshold',
        },
        minTransactionsInTimeWindow1: {
          type: 'integer',
          title: 'Minimum number of transactions in time period 1',
          nullable: true,
        },
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['multiplierThreshold', 'timeWindow1', 'timeWindow2'],
    }
  }

  public async computeRule() {
    const {
      multiplierThreshold,
      minTransactionsInTimeWindow1,
      timeWindow1,
      timeWindow2,
      checkSender,
      checkReceiver,
    } = this.parameters
    if (multiplierThreshold === undefined) {
      throw new MissingRuleParameter()
    }

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const [result1, result2] = await Promise.all([
      getTransactionUserPastTransactionsCount(
        this.transaction,
        this.transactionRepository,
        {
          timeWindow: timeWindow1,
          checkSender: checkSender || 'all',
          checkReceiver: checkReceiver || 'all',
          transactionTypes: this.filters.transactionTypes,
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
        }
      ),
      getTransactionUserPastTransactionsCount(
        this.transaction,
        this.transactionRepository,
        {
          timeWindow: timeWindow2,
          checkSender: checkSender || 'all',
          checkReceiver: checkReceiver || 'all',
          transactionTypes: this.filters.transactionTypes,
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
        }
      ),
    ])
    const senderTransactionsCount1 =
      (result1.senderReceivingTransactionsCount ?? 0) +
      (result1.senderSendingTransactionsCount ?? 0) +
      1
    const senderTransactionsCount2 =
      (result2.senderReceivingTransactionsCount ?? 0) +
      (result2.senderSendingTransactionsCount ?? 0) +
      1
    const receiverTransactionsCount1 =
      (result1.receiverReceivingTransactionsCount ?? 0) +
      (result1.receiverSendingTransactionsCount ?? 0) +
      1
    const receiverTransactionsCount2 =
      (result2.receiverReceivingTransactionsCount ?? 0) +
      (result2.receiverSendingTransactionsCount ?? 0) +
      1

    if (
      checkSender !== 'none' &&
      (!minTransactionsInTimeWindow1 ||
        senderTransactionsCount1 >= minTransactionsInTimeWindow1) &&
      senderTransactionsCount2 - senderTransactionsCount1 > 0 &&
      senderTransactionsCount1 >
        multiplierThreshold *
          (senderTransactionsCount2 - senderTransactionsCount1)
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
        },
      }
    }
    if (
      checkReceiver !== 'none' &&
      (!minTransactionsInTimeWindow1 ||
        receiverTransactionsCount1 >= minTransactionsInTimeWindow1) &&
      receiverTransactionsCount2 - receiverTransactionsCount1 > 0 &&
      receiverTransactionsCount1 >
        multiplierThreshold *
          (receiverTransactionsCount2 - receiverTransactionsCount1)
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('destination'),
        },
      }
    }
  }
}

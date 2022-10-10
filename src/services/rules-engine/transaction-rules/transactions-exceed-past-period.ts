import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserType } from '../utils/user-rule-utils'
import {
  getTransactionUserPastTransactionsCount,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export type TransactionsExceedPastPeriodRuleParameters =
  DefaultTransactionRuleParameters & {
    multiplierThreshold: number
    timeWindow1: TimeWindow
    timeWindow2: TimeWindow

    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'

    // Optional parameters
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    userType?: UserType
  }

export default class TransactionsExceedPastPeriodRule extends TransactionRule<TransactionsExceedPastPeriodRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsExceedPastPeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        multiplierThreshold: {
          type: 'integer',
          title: 'Multiplier threshold',
          description:
            'rule is run when the number of transactions of time period 2 is greater than the number of transactions of time period 1 multiplied by this threshold',
        },
        timeWindow1: TIME_WINDOW_SCHEMA({
          title: 'Time Period 1',
        }),
        timeWindow2: TIME_WINDOW_SCHEMA({
          title: 'Time Period 2',
          description:
            'Should be larger than time period 1. Time period 1 is excluded',
        }),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
      },
      required: ['multiplierThreshold', 'timeWindow1', 'timeWindow2'],
    }
  }

  public getFilters() {
    const { transactionTypes, paymentMethod, userType } = this.parameters
    return super
      .getFilters()
      .concat([
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
        () =>
          !paymentMethod ||
          this.transaction.originPaymentDetails?.method === paymentMethod,
        () => isUserType(this.senderUser, userType),
      ])
  }

  public async computeRule() {
    const {
      multiplierThreshold,
      timeWindow1,
      timeWindow2,
      checkSender,
      checkReceiver,
      transactionTypes,
      transactionState,
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
          transactionTypes,
          transactionState,
        }
      ),
      getTransactionUserPastTransactionsCount(
        this.transaction,
        this.transactionRepository,
        {
          timeWindow: timeWindow2,
          checkSender: checkSender || 'all',
          checkReceiver: checkReceiver || 'all',
          transactionTypes,
          transactionState,
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

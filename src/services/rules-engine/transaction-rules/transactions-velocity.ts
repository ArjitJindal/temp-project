import { JSONSchemaType } from 'ajv'
import { TransactionFilters } from '../transaction-filters'
import {
  TransactionsFilterOptions,
  TransactionRepository,
  AuxiliaryIndexTransaction,
} from '../repositories/transaction-repository'
import { subtractTime } from '../utils/time-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
  PAYMENT_CHANNEL_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'
import dayjs from '@/utils/dayjs'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type TransactionsVelocityRuleParameters = {
  transactionsLimit: number
  timeWindow: TimeWindow

  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'

  // Optional parameters
  userIdsToCheck?: string[] // If empty, all users will be checked
  onlyCheckKnownUsers?: boolean
  paymentChannel?: string
}

export default class TransactionsVelocityRule extends TransactionRule<
  TransactionsVelocityRuleParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
        userIdsToCheck: {
          type: 'array',
          title: 'Target User IDs',
          items: { type: 'string' },
          nullable: true,
        },
        onlyCheckKnownUsers: {
          type: 'boolean',
          title: 'Only check transactions from known users (with user ID)',
          nullable: true,
        },
        paymentChannel: PAYMENT_CHANNEL_OPTIONAL_SCHEMA(),
      },
      required: ['transactionsLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    const {
      transactionsLimit,
      timeWindow,
      checkSender,
      checkReceiver,
      onlyCheckKnownUsers,
      userIdsToCheck,
      paymentChannel,
    } = this.parameters

    if (
      (this.senderUser &&
        userIdsToCheck &&
        userIdsToCheck.length > 0 &&
        !userIdsToCheck?.includes(this.senderUser.userId)) ||
      (paymentChannel &&
        (this.transaction.originPaymentDetails as CardDetails)
          .paymentChannel !== paymentChannel)
    ) {
      return
    }

    if (
      onlyCheckKnownUsers &&
      (!this.transaction.originUserId || !this.transaction.destinationUserId)
    ) {
      return
    }

    if (transactionsLimit === undefined) {
      throw new MissingRuleParameter()
    }

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )

    const senderTransactionsCountPromise = checkSender
      ? this.getTransactionsCount(
          this.transaction.originUserId,
          this.transaction.originPaymentDetails,
          afterTimestamp,
          checkSender,
          onlyCheckKnownUsers
        )
      : Promise.resolve(0)
    const receiverTransactionsCountPromise = checkReceiver
      ? this.getTransactionsCount(
          this.transaction.destinationUserId,
          this.transaction.destinationPaymentDetails,
          afterTimestamp,
          checkReceiver,
          onlyCheckKnownUsers
        )
      : Promise.resolve(0)
    const [senderTransactionsCount, receiverTransactionsCount] =
      await Promise.all([
        senderTransactionsCountPromise,
        receiverTransactionsCountPromise,
      ])

    const hitResult: RuleHitResult = []
    if (senderTransactionsCount + 1 > transactionsLimit) {
      const transactionsDif = senderTransactionsCount - transactionsLimit + 1
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactionsDif: transactionsDif,
        },
      })
    }
    if (receiverTransactionsCount + 1 > transactionsLimit) {
      const transactionsDif = receiverTransactionsCount - transactionsLimit + 1
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          transactionsDif: transactionsDif,
        },
      })
    }
    return hitResult
  }

  private async getTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    afterTimestamp: number,
    checkType: 'sending' | 'receiving' | 'all' | 'none',
    onlyCheckKnownUsers = false
  ) {
    const transactionRepository = this
      .transactionRepository as TransactionRepository
    const timeRange = {
      afterTimestamp,
      beforeTimestamp: this.transaction.timestamp!,
    }
    const originFilterOptions: TransactionsFilterOptions = {
      transactionState: this.filters.transactionState,
      transactionTypes: this.filters.transactionTypes,
      originPaymentMethod: this.filters.paymentMethod,
      originCountries: this.filters.transactionCountries,
    }
    const destinationFilterOptions: TransactionsFilterOptions = {
      transactionState: this.filters.transactionState,
      transactionTypes: this.filters.transactionTypes,
      destinationPaymentMethod: this.filters.paymentMethod,
      destinationCountries: this.filters.transactionCountries,
    }
    const transactionsCount = await Promise.all([
      checkType === 'sending' || checkType === 'all'
        ? onlyCheckKnownUsers
          ? (async () =>
              this.getTransactionsCountForKnownUsers(
                await transactionRepository.getGenericUserSendingTransactions(
                  userId,
                  paymentDetails,
                  timeRange,
                  originFilterOptions,
                  ['originUserId', 'destinationUserId']
                ),
                'sending'
              ))()
          : transactionRepository.getGenericUserSendingTransactionsCount(
              userId,
              paymentDetails,
              timeRange,
              originFilterOptions
            )
        : Promise.resolve(0),
      checkType === 'receiving' || checkType === 'all'
        ? onlyCheckKnownUsers
          ? (async () =>
              this.getTransactionsCountForKnownUsers(
                await transactionRepository.getGenericUserReceivingTransactions(
                  userId,
                  paymentDetails,
                  timeRange,
                  destinationFilterOptions,
                  ['originUserId', 'destinationUserId']
                ),
                'receiving'
              ))()
          : transactionRepository.getGenericUserReceivingTransactionsCount(
              userId,
              paymentDetails,
              timeRange,
              destinationFilterOptions
            )
        : Promise.resolve(0),
    ])
    return transactionsCount[0] + transactionsCount[1]
  }

  private getTransactionsCountForKnownUsers(
    transactions: AuxiliaryIndexTransaction[],
    direction: 'sending' | 'receiving'
  ): number {
    return transactions.filter((transaction) =>
      direction === 'sending'
        ? transaction.originUserId
        : transaction.destinationUserId
    ).length
  }
}

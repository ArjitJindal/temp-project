import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import {
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'

import dayjs from '@/utils/dayjs'
import { RuleResult } from '@/services/rules-engine/rule'
import {
  DefaultTransactionRuleParameters,
  TransactionRule,
} from '@/services/rules-engine/transaction-rules/rule'
import { isUserType } from '@/services/rules-engine/utils/user-rule-utils'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

type Filters = DefaultTransactionRuleParameters & {
  transactionTypes?: TransactionType[]
  paymentMethod?: PaymentMethod
  userType?: UserType
}

export type HighTrafficVolumeBetweenSameUsersParameters = Filters & {
  timeWindow: TimeWindow
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  transactionsLimit?: number
}

export default class HighTrafficVolumeBetweenSameUsers extends TransactionRule<HighTrafficVolumeBetweenSameUsersParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficVolumeBetweenSameUsersParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions Volume Threshold',
        }),
        transactionsLimit: TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
      },
      required: ['timeWindow', 'transactionVolumeThreshold'],
    }
  }

  public getFilters() {
    const filters = super.getFilters()
    const { transactionTypes, paymentMethod, userType } = this.parameters
    const result = [
      ...filters,
      () => isTransactionInTargetTypes(this.transaction.type, transactionTypes),
    ]
    if (paymentMethod != null) {
      result.push(
        () => this.transaction.originPaymentDetails?.method === paymentMethod
      )
    }
    if (userType != null) {
      result.push(() => isUserType(this.senderUser, userType))
    }
    return result
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    const { transactionVolumeThreshold, transactionsLimit } = this.parameters
    const { transactions } = await this.computeResults()

    const targetCurrency = Object.keys(transactionVolumeThreshold)[0]
    const transactionAmounts = await getTransactionsTotalAmount(
      transactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    let volumeDelta = null
    let volumeThreshold = null
    if (
      transactionAmounts != null &&
      transactionVolumeThreshold[targetCurrency] != null
    ) {
      volumeDelta = {
        transactionAmount:
          transactionAmounts.transactionAmount -
          transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
      volumeThreshold = {
        transactionAmount: transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
    }

    let countHit = true
    if (Number.isFinite(transactionsLimit)) {
      const highTrafficCountRule = new HighTrafficBetweenSameParties(
        this.tenantId,
        {
          transaction: this.transaction,
          senderUser: this.senderUser,
          receiverUser: this.receiverUser,
        },
        {
          parameters: this
            .parameters as HighTrafficVolumeBetweenSameUsersParameters & {
            transactionsLimit: number
          },
          action: this.action,
        },
        this.dynamoDb
      )
      const countResult = await highTrafficCountRule.computeRule()
      countHit = Boolean(countResult)
    }

    if (
      (await isTransactionAmountAboveThreshold(
        transactionAmounts,
        transactionVolumeThreshold
      )) &&
      countHit
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          transactions,
          volumeDelta,
          volumeThreshold,
        },
      }
    }
    return undefined
  }

  private async computeResults() {
    const { timeWindow } = this.parameters
    if (timeWindow === undefined) {
      throw new MissingRuleParameter()
    }
    const { transaction } = this
    const { originUserId, timestamp } = transaction

    if (timestamp == null) {
      throw new Error(`Transaction timestamp is missing`)
    }
    if (originUserId == null) {
      throw new Error(`Origin user ID is missing`)
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const transactions = await transactionRepository.getUserSendingTransactions(
      originUserId,
      {
        beforeTimestamp: timestamp,
        afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
      },
      {
        transactionState: this.parameters.transactionState,
        transactionTypes: this.parameters.transactionTypes,
        receiverKeyId: getReceiverKeys(this.tenantId, transaction)
          ?.PartitionKeyID,
        originPaymentMethod: this.parameters.paymentMethod,
      },
      ['originAmountDetails']
    )

    return { transactions }
  }
}

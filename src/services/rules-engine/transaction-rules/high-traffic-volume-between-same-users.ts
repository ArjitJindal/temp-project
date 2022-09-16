import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import dayjs from '@/utils/dayjs'
import { RuleResult, TimeWindow } from '@/services/rules-engine/rule'
import {
  DefaultTransactionRuleParameters,
  TransactionRule,
} from '@/services/rules-engine/transaction-rules/rule'
import { isUserType } from '@/services/rules-engine/utils/user-rule-utils'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

type Filters = DefaultTransactionRuleParameters & {
  transactionTypes?: TransactionType[]
  paymentMethod?: string
  userType?: UserType
}

export type HighTrafficVolumeBetweenSameUsersParameters = Filters & {
  timeWindow: TimeWindow
  transactionVolumeThreshold: {
    [currency: string]: number
  }
}

export default class HighTrafficVolumeBetweenSameUsers extends TransactionRule<HighTrafficVolumeBetweenSameUsersParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficVolumeBetweenSameUsersParameters> {
    return {
      type: 'object',
      properties: {
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
          nullable: true,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          enum: ['ACH', 'CARD', 'IBAN', 'SWIFT', 'UPI', 'WALLET'],
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          enum: ['CONSUMER', 'BUSINESS'],
          nullable: true,
        },
        timeWindow: {
          type: 'object',
          title: 'Time Window',
          properties: {
            units: { type: 'integer', title: 'Number of time unit' },
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
            },
            rollingBasis: {
              type: 'boolean',
              title: 'Rolling basis',
              description:
                'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
              nullable: true,
            },
          },
          required: ['units', 'granularity'],
        },
        transactionVolumeThreshold: {
          type: 'object',
          title: 'Transactions Volume Threshold',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
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
    const { transactionVolumeThreshold } = this.parameters
    const { transactions } = await this.computeResults()

    const targetCurrency = Object.keys(transactionVolumeThreshold)[0]
    const transactionAmounts = await getTransactionsTotalAmount(
      transactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    let volumeDelta
    let volumeThreshold
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
    } else {
      volumeDelta = null
      volumeThreshold = null
    }

    if (
      await isTransactionAmountAboveThreshold(
        transactionAmounts,
        transactionVolumeThreshold
      )
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

    const thinTransactions =
      await transactionRepository.getUserSendingThinTransactions(
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
        }
      )
    const transactions = (
      await transactionRepository.getTransactionsByIds(
        thinTransactions.map((transaction) => transaction.transactionId)
      )
    ).filter(
      (transaction) =>
        !this.parameters.paymentMethod ||
        transaction.originPaymentDetails?.method ===
          this.parameters.paymentMethod
    )

    return { transactions }
  }
}

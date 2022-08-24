import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
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
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export type Filters = DefaultTransactionRuleParameters & {
  transactionTypes?: TransactionType[]
  paymentMethod?: string
  userType?: UserType
}

export type Parameters = Filters & {
  timeWindowInDays: number
  transactionsLimit: number
}

export default class HighTrafficBetweenSameParties extends TransactionRule<Parameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<Parameters> {
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
        timeWindowInDays: {
          type: 'number',
          title: 'Time Window (Days)',
        },
        transactionsLimit: {
          type: 'number',
          title: 'Max transactions per time window',
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
      required: ['timeWindowInDays', 'transactionsLimit'],
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
    const { transactionsLimit } = this.parameters
    const { count } = await this.computeResults()

    if (count > transactionsLimit) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          count,
          delta: count - this.parameters.transactionsLimit,
        },
      }
    }
    return undefined
  }

  private async computeResults() {
    const { timeWindowInDays } = this.parameters
    if (timeWindowInDays === undefined) {
      throw new MissingRuleParameter()
    }
    const { transaction } = this
    const { originUserId, timestamp } = transaction

    if (timestamp == null) {
      throw new Error(`Transaction timestamp is missing`) // todo: better error
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const count =
      await transactionRepository.getGenericUserSendingTransactionsCount(
        originUserId,
        transaction.originPaymentDetails,
        {
          beforeTimestamp: timestamp,
          afterTimestamp: dayjs(timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
        },
        {
          transactionState: this.parameters.transactionState,
          transactionTypes: this.parameters.transactionTypes,
          receiverKeyId: getReceiverKeys(this.tenantId, transaction)
            ?.PartitionKeyID,
        }
      )
    return { count }
  }
}

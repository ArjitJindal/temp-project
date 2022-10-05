import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import {
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { subtractTime } from '../utils/time-utils'
import dayjs from '@/utils/dayjs'
import {
  DefaultTransactionRuleParameters,
  TransactionRule,
  TransactionVars,
} from '@/services/rules-engine/transaction-rules/rule'
import { isUserType } from '@/services/rules-engine/utils/user-rule-utils'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

type Filters = DefaultTransactionRuleParameters & {
  transactionTypes?: TransactionType[]
  paymentMethod?: PaymentMethod
  userType?: UserType
}

export type HighTrafficBetweenSamePartiesParameters = Filters & {
  timeWindow: TimeWindow
  transactionsLimit: number
}

type HighTrafficBetweenSamePartiesRuleResult = {
  action: RuleAction
  vars: TransactionVars<HighTrafficBetweenSamePartiesParameters> & {
    count: number
    delta: number
  }
}

export default class HighTrafficBetweenSameParties extends TransactionRule<HighTrafficBetweenSamePartiesParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficBetweenSamePartiesParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
      },
      required: ['timeWindow', 'transactionsLimit'],
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

  public async computeRule(): Promise<
    HighTrafficBetweenSamePartiesRuleResult | undefined
  > {
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
    const { timeWindow } = this.parameters
    if (timeWindow === undefined) {
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
          afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
        },
        {
          transactionState: this.parameters.transactionState,
          originPaymentMethod: this.parameters.paymentMethod,
          transactionTypes: this.parameters.transactionTypes,
          receiverKeyId: getReceiverKeys(this.tenantId, transaction)
            ?.PartitionKeyID,
        }
      )
    return { count: count + 1 }
  }
}

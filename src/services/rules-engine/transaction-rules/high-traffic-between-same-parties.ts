import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { subtractTime } from '../utils/time-utils'
import { TransactionFilters } from '../transaction-filters'
import dayjs from '@/utils/dayjs'
import {
  TransactionRule,
  TransactionVars,
} from '@/services/rules-engine/transaction-rules/rule'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'
import { RuleAction } from '@/@types/openapi-public/RuleAction'

export type HighTrafficBetweenSamePartiesParameters = {
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

export default class HighTrafficBetweenSameParties extends TransactionRule<
  HighTrafficBetweenSamePartiesParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficBetweenSamePartiesParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['timeWindow', 'transactionsLimit'],
    }
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
          transactionState: this.filters.transactionState,
          originPaymentMethod: this.filters.paymentMethod,
          transactionTypes: this.filters.transactionTypes,
          receiverKeyId: getReceiverKeys(this.tenantId, transaction)
            ?.PartitionKeyID,
        }
      )
    return { count: count + 1 }
  }
}
